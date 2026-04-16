/**
 * UnClick Memory Admin - Vercel serverless function
 *
 * Route: GET|POST|DELETE /api/memory-admin?action=<action>&...
 *
 * Admin actions (read/write the 6 memory layers):
 *   - status: Returns counts per layer + decay tier distribution
 *   - business_context: Returns all business context entries
 *   - sessions: Returns recent session summaries (limit param)
 *   - facts: Returns extracted facts with optional search (query param)
 *   - library: Returns knowledge library index
 *   - library_doc: Returns full document by slug (slug param)
 *   - conversations: Returns conversation log for a session (session_id param)
 *   - code: Returns code dumps (session_id param optional)
 *   - search: Full-text search across conversation logs (query param)
 *   - delete_fact: Archive a fact by ID (fact_id, POST)
 *   - delete_session: DELETE a session summary by ID (session_id, POST)
 *   - update_business_context: Upsert a business context entry (POST)
 *
 * BYOD / wizard actions (control plane, keyed by UnClick API key):
 *   - setup: POST with { api_key, service_role_key, supabase_url?, email? }
 *            Validates + JWT-decodes the URL, installs schema via exec_sql
 *            RPC, and stores encrypted creds
 *   - setup_status: GET ?api_key=... — returns whether cloud memory is on
 *   - disconnect: DELETE ?api_key=... — removes a user's memory config
 *   - config: GET with Bearer <api_key> — MCP fetches decrypted creds
 *   - device_check: POST with Bearer <api_key> + fingerprint — heartbeat
 *                   + nudge signal
 *   - list_devices: GET with Bearer <api_key>
 *   - remove_device: DELETE ?fingerprint=... with Bearer (or ?dismiss=1)
 *
 * Cron actions (called by Vercel cron with Authorization: Bearer <CRON_SECRET>):
 *   - nightly_decay: Iterate every Pro/Team api_key and run mc_manage_decay
 *                    against the central managed-cloud schema. Free-tier
 *                    accounts are skipped (decay is a Pro perk per the v2
 *                    build plan).
 *
 * Phase 2 auth actions (keyed by Supabase Auth session JWT - Bearer from
 * the browser's supabase-js session, NOT an UnClick api_key):
 *   - claim_api_key: POST with { api_key } - link an anonymous api_keys
 *                    row to the signed-in auth.users row. Server
 *                    verifies that api_keys.email matches the session
 *                    user email before setting user_id.
 *   - auth_device_pair: POST with { device_id, device_name? } - upsert
 *                       a row in auth_devices for the signed-in user.
 *                       Stub today (no real pairing protocol yet, just
 *                       record the row so the UI has data to render).
 *   - auth_device_list: GET - list auth_devices rows for the signed-in
 *                       user.
 *   - auth_device_revoke: POST with { device_id } - mark the row as
 *                         revoked. Soft delete.
 *
 * Note: the auth_device_* actions are namespaced separately from the
 * existing memory device_check/list_devices/remove_device actions which
 * are api_key_hash-keyed and operate on memory_devices (Phase 1).
 * auth_devices is user_id-keyed and is for authenticated device
 * pairing. Distinct concepts, distinct tables, distinct handlers.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── Crypto helpers (mirror /api/credentials) ──────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 32;

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deriveKey(apiKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(apiKey, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function encryptString(plaintext: string, key: Buffer) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
  };
}

function decryptString(iv: string, authTag: string, ciphertext: string, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Decode a Supabase service_role JWT and return the project ref. */
function decodeProjectRef(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      ref?: string;
      role?: string;
    };
    if (payload.role !== "service_role") return null;
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

/** Load the bundled memory schema SQL. */
function loadSchemaSql(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "packages", "memory-mcp", "schema.sql"),
    path.join(here, "..", "..", "packages", "memory-mcp", "schema.sql"),
    path.join(process.cwd(), "packages", "memory-mcp", "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "";
}

/** Try to install the memory schema via the user's Supabase exec_sql RPC. */
async function installSchema(supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  const sql = loadSchemaSql();
  if (!sql) return false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Probe whether the schema is live. */
async function verifySchema(supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/business_context?select=id&limit=1`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function bearerFrom(req: VercelRequest): string {
  return (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * Resolve a Supabase Auth session JWT to the underlying auth.users row.
 * Used by Phase 2 auth actions (claim_api_key, auth_device_*) which are
 * called from the browser with the active supabase-js session token.
 * Returns null if the token is missing, invalid, or expired.
 *
 * Distinct from bearerFrom() + api_keys lookup, which is the
 * api_key-based auth path used by BYOD and memory tooling.
 */
async function resolveSessionUser(
  req: VercelRequest,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ id: string; email: string | null } | null> {
  const token = bearerFrom(req);
  if (!token) return null;
  // Tokens that look like UnClick api_keys (uc_* / agt_*) are never
  // valid session JWTs. Reject early to avoid sending garbage to
  // supabase.auth.getUser.
  if (token.startsWith("uc_") || token.startsWith("agt_")) return null;

  try {
    // Use an anon client scoped to this token. getUser() verifies the
    // JWT against the project's Auth secret server-side.
    const scoped = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await scoped.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database service unavailable" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const action = (req.query.action as string) || "status";

  try {
    switch (action) {
      case "status": {
        const [bc, lib, sessions, facts, convos, code] = await Promise.all([
          supabase.from("business_context").select("id", { count: "exact", head: true }),
          supabase.from("knowledge_library").select("id", { count: "exact", head: true }),
          supabase.from("session_summaries").select("id", { count: "exact", head: true }),
          supabase.from("extracted_facts").select("id", { count: "exact", head: true }),
          supabase.from("conversation_log").select("id", { count: "exact", head: true }),
          supabase.from("code_dumps").select("id", { count: "exact", head: true }),
        ]);

        // Decay tier distribution from facts
        const { data: factsTiers } = await supabase
          .from("extracted_facts")
          .select("decay_tier, status");

        const tiers = { hot: 0, warm: 0, cold: 0 };
        const statuses = { active: 0, superseded: 0, archived: 0, disputed: 0 };
        for (const f of factsTiers ?? []) {
          if (f.decay_tier && tiers[f.decay_tier as keyof typeof tiers] !== undefined) {
            tiers[f.decay_tier as keyof typeof tiers]++;
          }
          if (f.status && statuses[f.status as keyof typeof statuses] !== undefined) {
            statuses[f.status as keyof typeof statuses]++;
          }
        }

        return res.status(200).json({
          mode: "supabase",
          layers: {
            business_context: bc.count ?? 0,
            knowledge_library: lib.count ?? 0,
            session_summaries: sessions.count ?? 0,
            extracted_facts: facts.count ?? 0,
            conversation_log: convos.count ?? 0,
            code_dumps: code.count ?? 0,
          },
          decay_tiers: tiers,
          fact_statuses: statuses,
        });
      }

      case "business_context": {
        const { data, error } = await supabase
          .from("business_context")
          .select("*")
          .order("category")
          .order("key");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "sessions": {
        const limit = parseInt(req.query.limit as string) || 20;
        const { data, error } = await supabase
          .from("session_summaries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "facts": {
        const query = req.query.query as string;
        const showAll = req.query.show_all === "true";
        let q = supabase
          .from("extracted_facts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (!showAll) {
          q = q.eq("status", "active");
        }

        const { data, error } = await q;
        if (error) throw error;

        let results = data ?? [];
        if (query) {
          const lower = query.toLowerCase();
          results = results.filter(
            (f: { fact: string; category: string }) =>
              f.fact.toLowerCase().includes(lower) || f.category.toLowerCase().includes(lower)
          );
        }

        return res.status(200).json({ data: results });
      }

      case "library": {
        const { data, error } = await supabase
          .from("knowledge_library")
          .select("slug, title, category, tags, version, updated_at, created_at")
          .order("category")
          .order("title");

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "library_doc": {
        const slug = req.query.slug as string;
        if (!slug) return res.status(400).json({ error: "slug parameter required" });

        const { data, error } = await supabase
          .from("knowledge_library")
          .select("*")
          .eq("slug", slug)
          .single();

        if (error) throw error;

        const { data: history } = await supabase
          .from("knowledge_library_history")
          .select("*")
          .eq("slug", slug)
          .order("version", { ascending: false });

        return res.status(200).json({ doc: data, history: history ?? [] });
      }

      case "conversations": {
        const sessionId = req.query.session_id as string;
        if (!sessionId) {
          // Return distinct session IDs with message counts
          const { data, error } = await supabase
            .from("conversation_log")
            .select("session_id, created_at")
            .order("created_at", { ascending: false })
            .limit(500);

          if (error) throw error;

          const sessionMap = new Map<string, { count: number; last_message: string }>();
          for (const msg of data ?? []) {
            const existing = sessionMap.get(msg.session_id);
            if (existing) {
              existing.count++;
            } else {
              sessionMap.set(msg.session_id, { count: 1, last_message: msg.created_at });
            }
          }

          const sessions = Array.from(sessionMap.entries()).map(([id, info]) => ({
            session_id: id,
            message_count: info.count,
            last_message: info.last_message,
          }));

          return res.status(200).json({ data: sessions });
        }

        const { data, error } = await supabase
          .from("conversation_log")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "code": {
        const sessionId = req.query.session_id as string;
        let q = supabase
          .from("code_dumps")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (sessionId) {
          q = q.eq("session_id", sessionId);
        }

        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "search": {
        const query = req.query.query as string;
        if (!query) return res.status(400).json({ error: "query parameter required" });

        const maxResults = parseInt(req.query.max_results as string) || 20;
        const { data, error } = await supabase.rpc("search_memory", {
          search_query: query,
          max_results: maxResults,
        });

        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "delete_fact": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const factId = req.body?.fact_id || req.query.fact_id;
        if (!factId) return res.status(400).json({ error: "fact_id required" });

        const { error } = await supabase
          .from("extracted_facts")
          .update({ status: "archived" })
          .eq("id", factId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "delete_session": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const sessionId = req.body?.session_id || req.query.session_id;
        if (!sessionId) return res.status(400).json({ error: "session_id required" });

        const { error } = await supabase
          .from("session_summaries")
          .delete()
          .eq("id", sessionId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "update_business_context": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const { category, key, value, priority } = req.body ?? {};
        if (!category || !key || value === undefined) {
          return res.status(400).json({ error: "category, key, and value required" });
        }

        const { error } = await supabase
          .from("business_context")
          .upsert(
            {
              category,
              key,
              value: typeof value === "string" ? value : JSON.stringify(value),
              priority: priority ?? 0,
              decay_tier: "hot",
              updated_at: new Date().toISOString(),
              last_accessed: new Date().toISOString(),
            },
            { onConflict: "category,key" }
          );

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── BYOD / wizard actions ────────────────────────────────────────
      case "setup_status": {
        const apiKey = String(req.query.api_key ?? "").trim();
        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        const { data, error } = await supabase
          .from("memory_configs")
          .select("supabase_url,schema_installed,schema_installed_at,last_used_at,updated_at")
          .eq("api_key_hash", sha256hex(apiKey))
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(200).json({ configured: false });
        return res.status(200).json({ configured: true, ...data });
      }

      case "setup": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const body = req.body as {
          api_key?: string;
          service_role_key?: string;
          supabase_url?: string;
          email?: string;
        };
        const apiKey = (body?.api_key ?? "").trim();
        const serviceRoleKey = (body?.service_role_key ?? "").trim();
        let userSupabaseUrl = (body?.supabase_url ?? "").trim();
        const email = body?.email?.trim().toLowerCase();

        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        if (!apiKey.startsWith("uc_") && !apiKey.startsWith("agt_")) {
          return res.status(400).json({ error: "Invalid api_key format" });
        }
        if (!serviceRoleKey || serviceRoleKey.length < 40) {
          return res.status(400).json({ error: "service_role_key looks invalid" });
        }

        if (!userSupabaseUrl) {
          const ref = decodeProjectRef(serviceRoleKey);
          if (!ref) {
            return res.status(400).json({
              error: "Couldn't read project ref from key. Paste the Supabase URL too.",
              need_url: true,
            });
          }
          userSupabaseUrl = `https://${ref}.supabase.co`;
        }

        // Validate creds by pinging the project.
        const pingRes = await fetch(`${userSupabaseUrl}/rest/v1/`, {
          headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        });
        if (!pingRes.ok && pingRes.status !== 404) {
          return res.status(400).json({
            error: `Supabase rejected that key (HTTP ${pingRes.status}). Double-check you copied service_role, not anon.`,
          });
        }

        const installed = await installSchema(userSupabaseUrl, serviceRoleKey);
        const schemaInstalled = installed || (await verifySchema(userSupabaseUrl, serviceRoleKey));

        const salt = crypto.randomBytes(SALT_BYTES);
        const encKey = deriveKey(apiKey, salt);
        const { iv, authTag, ciphertext } = encryptString(serviceRoleKey, encKey);

        const { error } = await supabase
          .from("memory_configs")
          .upsert(
            {
              api_key_hash: sha256hex(apiKey),
              email: email ?? null,
              supabase_url: userSupabaseUrl,
              encrypted_service_key: ciphertext,
              encryption_iv: iv,
              encryption_tag: authTag,
              encryption_salt: salt.toString("hex"),
              schema_installed: schemaInstalled,
              schema_installed_at: schemaInstalled ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "api_key_hash" }
          );
        if (error) throw error;

        return res.status(200).json({
          success: true,
          supabase_url: userSupabaseUrl,
          schema_installed: schemaInstalled,
          schema_sql: schemaInstalled ? undefined : loadSchemaSql(),
          message: schemaInstalled
            ? "Memory cloud sync is live. Restart your MCP client."
            : "Credentials saved. Run the included SQL in your Supabase SQL editor, then you're done.",
        });
      }

      case "disconnect": {
        if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });
        const apiKey = String(req.query.api_key ?? "").trim();
        if (!apiKey) return res.status(400).json({ error: "api_key required" });
        const { error } = await supabase
          .from("memory_configs")
          .delete()
          .eq("api_key_hash", sha256hex(apiKey));
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case "config": {
        // MCP server calls this at startup.
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_configs")
          .select("*")
          .eq("api_key_hash", sha256hex(apiKey))
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ configured: false, error: "No memory config" });

        try {
          const salt = Buffer.from(data.encryption_salt, "hex");
          const key = deriveKey(apiKey, salt);
          const serviceRoleKey = decryptString(
            data.encryption_iv,
            data.encryption_tag,
            data.encrypted_service_key,
            key
          );
          // Fire-and-forget last_used_at update
          supabase
            .from("memory_configs")
            .update({ last_used_at: new Date().toISOString() })
            .eq("api_key_hash", sha256hex(apiKey))
            .then(() => {});
          return res.status(200).json({
            configured: true,
            supabase_url: data.supabase_url,
            service_role_key: serviceRoleKey,
            schema_installed: data.schema_installed,
          });
        } catch {
          return res.status(500).json({
            error: "Failed to decrypt memory config. Your API key may have changed — rerun setup.",
          });
        }
      }

      case "device_check": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const body = req.body as {
          device_fingerprint?: string;
          label?: string;
          platform?: string;
          storage_mode?: "local" | "cloud";
        };
        const fp = (body?.device_fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "device_fingerprint required" });
        const mode = body?.storage_mode === "cloud" ? "cloud" : "local";
        const apiKeyHash = sha256hex(apiKey);

        const { error: upErr } = await supabase
          .from("memory_devices")
          .upsert(
            {
              api_key_hash: apiKeyHash,
              device_fingerprint: fp,
              label: body?.label ?? null,
              platform: body?.platform ?? null,
              storage_mode: mode,
              last_seen: new Date().toISOString(),
            },
            { onConflict: "api_key_hash,device_fingerprint" }
          );
        if (upErr) throw upErr;

        const { data: rows } = await supabase
          .from("memory_devices")
          .select("storage_mode,nudge_dismissed")
          .eq("api_key_hash", apiKeyHash);

        const list = (rows ?? []) as Array<{ storage_mode: string; nudge_dismissed: boolean }>;
        const totalDevices = list.length;
        const localDevices = list.filter((r) => r.storage_mode === "local").length;
        const anyDismissed = list.some((r) => r.nudge_dismissed);
        const nudge = mode === "local" && totalDevices >= 2 && localDevices >= 1 && !anyDismissed;

        return res.status(200).json({
          success: true,
          total_devices: totalDevices,
          local_devices: localDevices,
          nudge,
          nudge_message: nudge
            ? `You're using UnClick memory on ${totalDevices} machines. Turn on cloud sync: https://unclick.world/memory/setup`
            : null,
        });
      }

      case "list_devices": {
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const { data, error } = await supabase
          .from("memory_devices")
          .select("*")
          .eq("api_key_hash", sha256hex(apiKey))
          .order("last_seen", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "remove_device": {
        if (req.method !== "DELETE") return res.status(405).json({ error: "DELETE required" });
        const apiKey = bearerFrom(req);
        if (!apiKey) return res.status(401).json({ error: "Authorization header required" });
        const fp = String(req.query.fingerprint ?? "").trim();
        if (!fp) return res.status(400).json({ error: "fingerprint required" });
        const apiKeyHash = sha256hex(apiKey);

        if (req.query.dismiss === "1") {
          const { error } = await supabase
            .from("memory_devices")
            .update({ nudge_dismissed: true })
            .eq("api_key_hash", apiKeyHash)
            .eq("device_fingerprint", fp);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }

        const { error } = await supabase
          .from("memory_devices")
          .delete()
          .eq("api_key_hash", apiKeyHash)
          .eq("device_fingerprint", fp);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Phase 2 auth actions (session JWT, not api_key) ─────────────
      case "claim_api_key": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) {
          return res.status(401).json({ error: "Not signed in" });
        }
        if (!user.email) {
          return res.status(400).json({
            error: "Your account doesn't have a verified email yet. Complete sign in first.",
          });
        }
        const body = req.body as { api_key?: string };
        const apiKey = (body?.api_key ?? "").trim();
        if (!apiKey) return res.status(400).json({ error: "api_key required" });

        // Try new-shape lookup first (key_hash). Fall back to old-shape
        // (api_key plaintext column) - see api_keys two-shape drift
        // noted in 20260416000000_auth_foundation.sql.
        const apiKeyHash = sha256hex(apiKey);
        const { data: newShape, error: newErr } = await supabase
          .from("api_keys")
          .select("id, email, user_id")
          .eq("key_hash", apiKeyHash)
          .maybeSingle();
        if (newErr && newErr.code !== "PGRST116" && newErr.code !== "42703") {
          throw newErr;
        }

        let row = newShape as
          | { id: string; email: string | null; user_id: string | null }
          | null
          | undefined;

        if (!row) {
          const { data: oldShape, error: oldErr } = await supabase
            .from("api_keys")
            .select("id, email, user_id")
            .eq("api_key", apiKey)
            .maybeSingle();
          // 42703 = undefined_column (old-shape columns don't exist on
          // fresh databases). Treat as "not found" rather than a hard
          // failure.
          if (oldErr && oldErr.code !== "PGRST116" && oldErr.code !== "42703") {
            throw oldErr;
          }
          row = oldShape as typeof row;
        }

        if (!row) {
          return res.status(404).json({ error: "That API key doesn't exist." });
        }

        if (row.user_id && row.user_id !== user.id) {
          return res.status(409).json({
            error: "That API key is already linked to a different account.",
          });
        }

        if (row.email && row.email.toLowerCase() !== user.email.toLowerCase()) {
          return res.status(403).json({
            error:
              "The email on that API key doesn't match your signed-in email. Sign in with the email you used to create the key.",
          });
        }

        const { error: updErr } = await supabase
          .from("api_keys")
          .update({ user_id: user.id })
          .eq("id", row.id);
        if (updErr) throw updErr;

        return res.status(200).json({ success: true });
      }

      case "auth_device_pair": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Not signed in" });
        const body = req.body as { device_id?: string; device_name?: string };
        const deviceId = (body?.device_id ?? "").trim();
        if (!deviceId) return res.status(400).json({ error: "device_id required" });
        const deviceName = body?.device_name?.trim() || null;

        // Upsert on (user_id, device_id). This is a stub: pairing
        // today just means "I saw this device, record it". A real
        // pairing protocol (nonce + client-side confirmation) is a
        // later phase.
        const { data, error } = await supabase
          .from("auth_devices")
          .upsert(
            {
              user_id: user.id,
              device_id: deviceId,
              device_name: deviceName,
              last_seen_at: new Date().toISOString(),
              revoked_at: null,
            },
            { onConflict: "user_id,device_id" },
          )
          .select("id, device_id, device_name, paired_at, last_seen_at")
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, device: data });
      }

      case "auth_device_list": {
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Not signed in" });
        const { data, error } = await supabase
          .from("auth_devices")
          .select("id, device_id, device_name, paired_at, last_seen_at, revoked_at")
          .eq("user_id", user.id)
          .is("revoked_at", null)
          .order("last_seen_at", { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data ?? [] });
      }

      case "auth_device_revoke": {
        if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
        const user = await resolveSessionUser(req, supabaseUrl, supabaseKey);
        if (!user) return res.status(401).json({ error: "Not signed in" });
        const body = req.body as { device_id?: string };
        const deviceId = (body?.device_id ?? "").trim();
        if (!deviceId) return res.status(400).json({ error: "device_id required" });

        const { error } = await supabase
          .from("auth_devices")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("device_id", deviceId);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── Cron actions ────────────────────────────────────────────────
      case "nightly_decay": {
        // Vercel cron sends Authorization: Bearer <CRON_SECRET>. Reject any
        // request that doesn't match. If CRON_SECRET is unset the endpoint
        // refuses to run at all (fail closed; never expose decay to anon).
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return res
            .status(503)
            .json({ error: "CRON_SECRET not configured on the server" });
        }
        const auth = bearerFrom(req);
        if (auth !== cronSecret) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        // Pull all active non-free api_keys. Decay is a Pro tier perk.
        const { data: keys, error: keysErr } = await supabase
          .from("api_keys")
          .select("key_hash, tier")
          .eq("is_active", true)
          .neq("tier", "free");
        if (keysErr) throw keysErr;

        const results: Array<{
          api_key_hash: string;
          tier: string | null;
          ok: boolean;
          error?: string;
          decayed?: unknown;
        }> = [];

        for (const row of keys ?? []) {
          const { data: decayed, error: decayErr } = await supabase.rpc(
            "mc_manage_decay",
            { p_api_key_hash: row.key_hash }
          );
          if (decayErr) {
            results.push({
              api_key_hash: row.key_hash,
              tier: row.tier,
              ok: false,
              error: decayErr.message,
            });
          } else {
            results.push({
              api_key_hash: row.key_hash,
              tier: row.tier,
              ok: true,
              decayed,
            });
          }
        }

        return res.status(200).json({
          ran_at: new Date().toISOString(),
          tenants_processed: results.length,
          results,
          note:
            "Nightly extraction (LLM fact distillation from conversation_log) " +
            "is not yet implemented. See docs/sessions for the open question " +
            "to Chris about model selection.",
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Memory admin error (${action}):`, (err as Error).message);
    return res.status(500).json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}
