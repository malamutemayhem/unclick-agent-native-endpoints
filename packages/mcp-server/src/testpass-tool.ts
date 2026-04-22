/**
 * TestPass MCP tools.
 *
 * Thin wrappers over the UnClick /api/testpass serverless endpoint. The user's
 * UNCLICK_API_KEY is forwarded as the Bearer token so the endpoint can resolve
 * the calling tenant and scope DB writes to their account.
 */

const SITE_URL =
  process.env.UNCLICK_SITE_URL ||
  process.env.UNCLICK_MEMORY_BASE_URL ||
  "https://unclick.world";

type Profile = "smoke" | "standard" | "deep";

interface RunArgs {
  target_url?: string;
  pack_id?: string;
  profile?: Profile;
}

interface StatusArgs {
  run_id?: string;
}

function authHeader(): { Authorization: string } | { error: string } {
  const apiKey = process.env.UNCLICK_API_KEY;
  if (!apiKey) {
    return { error: "UNCLICK_API_KEY env var is not set. Get one at https://unclick.world" };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

export async function testpassRun(args: RunArgs): Promise<unknown> {
  if (!args.target_url) return { error: "target_url is required" };
  const auth = authHeader();
  if ("error" in auth) return auth;

  const body = {
    pack_slug: args.pack_id ?? "testpass-core",
    target: { type: "mcp", url: args.target_url },
    profile: args.profile ?? "smoke",
  };

  const res = await fetch(`${SITE_URL}/api/testpass?action=start_run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) return { error: `TestPass API HTTP ${res.status}: ${text}` };
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function testpassStatus(args: StatusArgs): Promise<unknown> {
  if (!args.run_id) return { error: "run_id is required" };
  const auth = authHeader();
  if ("error" in auth) return auth;

  const res = await fetch(
    `${SITE_URL}/api/testpass?action=status&run_id=${encodeURIComponent(args.run_id)}`,
    { headers: auth },
  );
  const text = await res.text();
  if (!res.ok) return { error: `TestPass API HTTP ${res.status}: ${text}` };
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
