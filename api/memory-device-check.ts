/**
 * UnClick Memory Device Check API
 *
 * POST /api/memory-device-check
 *   Authorization: Bearer <unclick_api_key>
 *   Body: { device_fingerprint, label?, platform?, storage_mode: 'local' | 'cloud' }
 *   Upserts the device into memory_devices. Returns nudge info when the user
 *   has 2+ devices but is still on local storage — that's the "hey, you're on
 *   a second machine, want to sync?" signal.
 *
 * GET /api/memory-device-check
 *   Authorization: Bearer <unclick_api_key>
 *   Lists the user's devices for the admin dashboard.
 *
 * DELETE /api/memory-device-check?fingerprint=<fp>
 *   Removes a device (or dismisses a nudge when ?dismiss=1).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "crypto";

function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function supabaseHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function sFetch(url: string, method: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const unclickSupabaseUrl = process.env.SUPABASE_URL;
  const unclickServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!unclickSupabaseUrl || !unclickServiceKey) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const apiKey = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return res.status(401).json({ error: "Authorization header required" });

  const apiKeyHash = sha256hex(apiKey);
  const headers = supabaseHeaders(unclickServiceKey);
  const tableUrl = `${unclickSupabaseUrl}/rest/v1/memory_devices`;

  // ── POST: heartbeat / register device ──
  if (req.method === "POST") {
    const body = req.body as {
      device_fingerprint?: string;
      label?: string;
      platform?: string;
      storage_mode?: "local" | "cloud";
    };
    const fp = (body?.device_fingerprint ?? "").trim();
    if (!fp) return res.status(400).json({ error: "device_fingerprint required" });
    const mode = body?.storage_mode === "cloud" ? "cloud" : "local";

    const row = {
      api_key_hash: apiKeyHash,
      device_fingerprint: fp,
      label: body?.label ?? null,
      platform: body?.platform ?? null,
      storage_mode: mode,
      last_seen: new Date().toISOString(),
    };

    const upsert = await sFetch(tableUrl, "POST", {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    }, row);

    if (!upsert.ok) return res.status(upsert.status).json({ error: "Failed to log device" });

    // Count devices + check if any are local (= nudge candidate)
    const listUrl = `${tableUrl}?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&select=storage_mode,nudge_dismissed`;
    const { data } = await sFetch(listUrl, "GET", headers);
    const rows = (data as Array<{ storage_mode: string; nudge_dismissed: boolean }>) ?? [];

    const totalDevices = rows.length;
    const localDevices = rows.filter((r) => r.storage_mode === "local").length;
    const anyDismissed = rows.some((r) => r.nudge_dismissed);

    // Show the nudge if this device is local and there are 2+ total devices and
    // the user hasn't dismissed it yet.
    const nudge = mode === "local" && totalDevices >= 2 && localDevices >= 1 && !anyDismissed;

    return res.status(200).json({
      success: true,
      total_devices: totalDevices,
      local_devices: localDevices,
      nudge,
      nudge_message: nudge
        ? `You're using UnClick memory on ${totalDevices} machines. Turn on cloud sync to share context across all of them: https://unclick.world/memory/setup`
        : null,
    });
  }

  // ── GET: list devices ──
  if (req.method === "GET") {
    const listUrl = `${tableUrl}?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&select=*&order=last_seen.desc`;
    const { ok, data } = await sFetch(listUrl, "GET", headers);
    if (!ok) return res.status(502).json({ error: "Lookup failed" });
    return res.status(200).json({ data: data ?? [] });
  }

  // ── DELETE: remove or dismiss ──
  if (req.method === "DELETE") {
    const fp = String(req.query.fingerprint ?? "").trim();
    if (!fp) return res.status(400).json({ error: "fingerprint required" });

    if (req.query.dismiss === "1") {
      const patchUrl = `${tableUrl}?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&device_fingerprint=eq.${encodeURIComponent(fp)}`;
      const { ok } = await sFetch(patchUrl, "PATCH", headers, { nudge_dismissed: true });
      if (!ok) return res.status(502).json({ error: "Failed to dismiss nudge" });
      return res.status(200).json({ success: true });
    }

    const delUrl = `${tableUrl}?api_key_hash=eq.${encodeURIComponent(apiKeyHash)}&device_fingerprint=eq.${encodeURIComponent(fp)}`;
    const { ok } = await sFetch(delUrl, "DELETE", headers);
    if (!ok) return res.status(502).json({ error: "Failed to remove device" });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
