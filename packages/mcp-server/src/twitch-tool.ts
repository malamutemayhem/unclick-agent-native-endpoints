// ── Twitch Helix API tool ───────────────────────────────────────────────────────
// Uses the Twitch Helix API (https://dev.twitch.tv/docs/api/).
// Authenticates with app access tokens via Client Credentials grant.
// Env vars: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET

const TWITCH_API = "https://api.twitch.tv/helix";
const TWITCH_AUTH = "https://id.twitch.tv/oauth2/token";

// ── App access token cache ─────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(
    `${TWITCH_AUTH}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Twitch auth HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function twitchGet(
  clientId: string,
  token: string,
  path: string,
  params: Record<string, string | number | boolean>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.append(k, String(v));
  }
  const url = `${TWITCH_API}${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch API HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getCredentials(args: Record<string, unknown>): { clientId: string; clientSecret: string } {
  const clientId = String(args.client_id ?? process.env.TWITCH_CLIENT_ID ?? "").trim();
  const clientSecret = String(args.client_secret ?? process.env.TWITCH_CLIENT_SECRET ?? "").trim();
  if (!clientId) throw new Error("client_id is required (or set TWITCH_CLIENT_ID env var).");
  if (!clientSecret) throw new Error("client_secret is required (or set TWITCH_CLIENT_SECRET env var).");
  return { clientId, clientSecret };
}

// ── Tool functions ─────────────────────────────────────────────────────────────

export async function twitchSearchStreams(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { query };
    if (args.first) params.first = Number(args.first);
    if (args.after) params.after = String(args.after);
    const data = await twitchGet(clientId, token, "/search/channels", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchGetStream(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const channel = String(args.channel ?? "").trim();
    if (!channel) return { error: "channel (login name) is required." };
    const data = await twitchGet(clientId, token, "/streams", { user_login: channel });
    const streams = (data.data as unknown[]) ?? [];
    if (streams.length === 0) return { live: false, channel };
    return { live: true, stream: streams[0] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchSearchGames(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string | number> = { query };
    if (args.first) params.first = Number(args.first);
    const data = await twitchGet(clientId, token, "/search/categories", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchGetTopGames(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const params: Record<string, string | number> = {};
    if (args.first) params.first = Number(args.first);
    if (args.after) params.after = String(args.after);
    const data = await twitchGet(clientId, token, "/games/top", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchGetClips(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const channel = String(args.channel ?? "").trim();
    if (!channel) return { error: "channel (login name) is required." };
    // First resolve user ID
    const userRes = await twitchGet(clientId, token, "/users", { login: channel });
    const users = (userRes.data as Array<Record<string, unknown>>) ?? [];
    if (users.length === 0) return { error: `Channel "${channel}" not found.` };
    const userId = String(users[0].id);
    const params: Record<string, string | number> = { broadcaster_id: userId };
    if (args.first) params.first = Number(args.first);
    if (args.after) params.after = String(args.after);
    const data = await twitchGet(clientId, token, "/clips", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchGetChannelInfo(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const channel = String(args.channel ?? "").trim();
    if (!channel) return { error: "channel (login name) is required." };
    const userRes = await twitchGet(clientId, token, "/users", { login: channel });
    const users = (userRes.data as Array<Record<string, unknown>>) ?? [];
    if (users.length === 0) return { error: `Channel "${channel}" not found.` };
    const userId = String(users[0].id);
    const chanRes = await twitchGet(clientId, token, "/channels", { broadcaster_id: userId });
    const channels = (chanRes.data as unknown[]) ?? [];
    return { user: users[0], channel_info: channels[0] ?? null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function twitchGetSchedule(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getAppToken(clientId, clientSecret);
    const channel = String(args.channel ?? "").trim();
    if (!channel) return { error: "channel (login name) is required." };
    const userRes = await twitchGet(clientId, token, "/users", { login: channel });
    const users = (userRes.data as Array<Record<string, unknown>>) ?? [];
    if (users.length === 0) return { error: `Channel "${channel}" not found.` };
    const userId = String(users[0].id);
    const params: Record<string, string | number> = { broadcaster_id: userId };
    if (args.first) params.first = Number(args.first);
    if (args.start_time) params.start_time = String(args.start_time);
    const data = await twitchGet(clientId, token, "/schedule", params);
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
