/**
 * testpass-tool - MCP handlers for starting TestPass runs and polling status.
 *
 * Both handlers call back into the UnClick Vercel API (/api/testpass) using
 * the caller's UNCLICK_API_KEY as the Bearer token. The API resolves the
 * caller's user id from that token and enforces actor_user_id scoping.
 */

const API_BASE = (process.env.UNCLICK_API_URL ?? "https://unclick.world").replace(/\/$/, "");

function getApiKey(): string {
  const key = process.env.UNCLICK_API_KEY?.trim();
  if (!key) {
    throw new Error("UNCLICK_API_KEY env var is not set. Get your install config at https://unclick.world");
  }
  return key;
}

export async function testpassRun(args: Record<string, unknown>): Promise<unknown> {
  const targetUrl = String(args.target_url ?? "");
  const packId = String(args.pack_id ?? "testpass-core");
  const profile = String(args.profile ?? "smoke");
  const taskId = typeof args.task_id === "string" && args.task_id ? args.task_id : undefined;
  if (!targetUrl) return { error: "target_url is required" };

  const apiKey = getApiKey();
  const requestBody: Record<string, unknown> = {
    pack_slug: packId,
    target: { type: "mcp", url: targetUrl },
    profile,
  };
  if (taskId) requestBody.task_id = taskId;
  const res = await fetch(`${API_BASE}/api/testpass?action=start_run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) return { error: `testpass start_run failed (HTTP ${res.status})`, body };
  return body;
}

export async function testpassStatus(args: Record<string, unknown>): Promise<unknown> {
  const runId = String(args.run_id ?? "");
  if (!runId) return { error: "run_id is required" };

  const apiKey = getApiKey();
  const res = await fetch(
    `${API_BASE}/api/testpass?action=status&run_id=${encodeURIComponent(runId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) return { error: `testpass status failed (HTTP ${res.status})`, body };
  return body;
}

export async function testpassSavePack(args: Record<string, unknown>): Promise<unknown> {
  const packId = String(args.pack_id ?? "");
  const yaml = String(args.yaml ?? "");
  if (!packId) return { error: "pack_id is required" };
  if (!yaml) return { error: "yaml is required" };

  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/api/testpass?action=save_pack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ pack_id: packId, yaml }),
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) return { error: `testpass save_pack failed (HTTP ${res.status})`, body };
  return body;
}

export async function testpassEditItem(args: Record<string, unknown>): Promise<unknown> {
  const runId = String(args.run_id ?? "");
  const itemId = String(args.item_id ?? "");
  const verdict = String(args.verdict ?? "");
  const notes = args.notes;
  if (!runId) return { error: "run_id is required" };
  if (!itemId) return { error: "item_id is required" };
  if (!["pass", "fail", "na"].includes(verdict)) {
    return { error: "verdict must be pass|fail|na" };
  }

  const payload: Record<string, unknown> = { run_id: runId, item_id: itemId, verdict };
  if (typeof notes === "string") payload.notes = notes;

  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/api/testpass?action=edit_item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) return { error: `testpass edit_item failed (HTTP ${res.status})`, body };
  return body;
}
