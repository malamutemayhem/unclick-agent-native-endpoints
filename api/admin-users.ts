/**
 * UnClick Admin Users - Vercel serverless function
 *
 * Route: GET /api/admin-users?action=<action>
 *
 * Superadmin-only actions gated on ADMIN_EMAILS env var (comma-separated
 * list of email addresses). Non-admins get 403. Separate from
 * memory-admin.ts because these actions query auth.users across all
 * tenants rather than scoped to a single api_key_hash.
 *
 * Actions:
 *   - admin_recent_signups: GET with Bearer <session_jwt>
 *     Returns the latest 100 users from auth.users with
 *     { id, email, provider, created_at, last_sign_in_at, confirmed }.
 *
 * Env:
 *   SUPABASE_URL                - project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - service role (needed for auth.admin.listUsers)
 *   ADMIN_EMAILS                - comma-separated superadmin allowlist
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function bearerFrom(req: VercelRequest): string {
  return (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
}

function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function resolveSessionUser(
  token: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  // api_keys (uc_* / agt_*) are never valid session JWTs — reject early.
  if (token.startsWith("uc_") || token.startsWith("agt_")) return null;
  try {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  // All actions require a session JWT + admin email check.
  const token = bearerFrom(req);
  const caller = await resolveSessionUser(token, supabaseUrl, serviceRoleKey);
  if (!caller) return res.status(401).json({ error: "Unauthorized" });

  const allow = adminEmailSet();
  const callerEmail = (caller.email ?? "").toLowerCase();
  if (allow.size === 0 || !callerEmail || !allow.has(callerEmail)) {
    // 403 is the signal the frontend uses to hide the widget entirely.
    return res.status(403).json({ error: "Forbidden" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (action) {
      case "admin_recent_signups": {
        if (req.method !== "GET") {
          return res.status(405).json({ error: "GET required" });
        }
        // auth.admin.listUsers is service-role-only; paginates 50/page.
        // We ask for 100 to see recent week+ of signups on a small tenant.
        const { data, error } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 100,
        });
        if (error) throw error;

        const users = (data?.users ?? [])
          .map((u) => ({
            id: u.id,
            email: u.email ?? null,
            provider:
              (u.app_metadata as { provider?: string } | undefined)?.provider ?? "email",
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            confirmed: Boolean(u.email_confirmed_at ?? u.phone_confirmed_at),
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );

        return res.status(200).json({ users });
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: unknown) {
    console.error(`Admin users error (${action}):`, (err as Error).message);
    return res
      .status(500)
      .json({ error: `Failed to execute ${action}: ${(err as Error).message}` });
  }
}
