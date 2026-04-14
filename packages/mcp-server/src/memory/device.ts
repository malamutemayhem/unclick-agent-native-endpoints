/**
 * Device heartbeat for UnClick Memory.
 *
 * Sends a lightweight fingerprint to the UnClick control plane on startup so
 * the admin dashboard can show where memory is in use, and so the backend can
 * nudge users toward cloud sync when they start using UnClick on a 2nd device.
 *
 * Fingerprint is SHA-256 of (hostname + platform + arch + home-dir). No PII.
 */

import * as os from "os";
import * as crypto from "crypto";

const MEMORY_API_BASE =
  process.env.UNCLICK_MEMORY_BASE_URL || process.env.UNCLICK_SITE_URL || "https://unclick.world";

function fingerprint(): string {
  const parts = [os.hostname(), os.platform(), os.arch(), os.homedir()].join("|");
  return crypto.createHash("sha256").update(parts).digest("hex");
}

interface HeartbeatResult {
  nudge: boolean;
  nudge_message: string | null;
}

/**
 * Fire-and-forget heartbeat. Returns nudge info if the user has multiple
 * devices on local storage so the MCP server can surface a hint.
 */
export async function sendDeviceHeartbeat(storageMode: "local" | "cloud"): Promise<HeartbeatResult | null> {
  const apiKey = process.env.UNCLICK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${MEMORY_API_BASE}/api/memory-admin?action=device_check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        device_fingerprint: fingerprint(),
        label: os.hostname(),
        platform: `${os.platform()}-${os.arch()}`,
        storage_mode: storageMode,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HeartbeatResult;
    return { nudge: Boolean(data.nudge), nudge_message: data.nudge_message ?? null };
  } catch {
    return null;
  }
}
