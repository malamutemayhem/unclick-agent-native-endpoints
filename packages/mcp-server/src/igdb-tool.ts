// IGDB games database API (powered by Twitch).
// Docs: https://api-docs.igdb.com/
// Auth: IGDB_CLIENT_ID + IGDB_CLIENT_SECRET (Twitch OAuth2 app credentials)
// Base: https://api.igdb.com/v4
// Token endpoint: https://id.twitch.tv/oauth2/token (client_credentials grant)

const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

// Simple in-process token cache (resets on restart)
let cachedToken: { token: string; expires: number } | null = null;

function getCredentials(args: Record<string, unknown>): { clientId: string; clientSecret: string } {
  const clientId = String(args.client_id ?? process.env.IGDB_CLIENT_ID ?? "").trim();
  const clientSecret = String(args.client_secret ?? process.env.IGDB_CLIENT_SECRET ?? "").trim();
  if (!clientId) throw new Error("client_id is required (or set IGDB_CLIENT_ID env var).");
  if (!clientSecret) throw new Error("client_secret is required (or set IGDB_CLIENT_SECRET env var).");
  return { clientId, clientSecret };
}

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const res = await fetch(
    `${TWITCH_TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (res.status === 400 || res.status === 401) {
    throw new Error("Invalid IGDB credentials. Check your client_id and client_secret.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch token request failed HTTP ${res.status}: ${body}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const token = String(json.access_token ?? "");
  const expiresIn = Number(json.expires_in ?? 3600);
  cachedToken = { token, expires: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

async function igdbPost(
  clientId: string,
  token: string,
  endpoint: string,
  body: string
): Promise<unknown> {
  const res = await fetch(`${IGDB_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
      Accept: "application/json",
    },
    body,
  });
  if (res.status === 401) {
    cachedToken = null;
    throw new Error("IGDB token expired or invalid. Try again.");
  }
  if (res.status === 429) throw new Error("IGDB rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`IGDB HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// igdb_search_games
export async function igdbSearchGames(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getTwitchToken(clientId, clientSecret);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const limit = Math.min(Number(args.limit ?? 10), 50);

    const body = `search "${query}"; fields id,name,summary,genres.name,platforms.name,release_dates.human,rating,rating_count,cover.url,url; limit ${limit};`;
    return igdbPost(clientId, token, "/games", body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// igdb_get_game
export async function igdbGetGame(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getTwitchToken(clientId, clientSecret);
    const gameId = String(args.game_id ?? "").trim();
    if (!gameId) return { error: "game_id is required." };

    const body = `fields id,name,summary,storyline,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,release_dates.human,rating,rating_count,aggregated_rating,aggregated_rating_count,cover.url,screenshots.url,websites.url,url; where id = ${gameId};`;
    const result = await igdbPost(clientId, token, "/games", body) as Array<unknown>;
    return result[0] ?? { error: "Game not found." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// igdb_list_platforms
export async function igdbListPlatforms(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getTwitchToken(clientId, clientSecret);
    const limit = Math.min(Number(args.limit ?? 30), 500);
    const offset = Number(args.offset ?? 0);

    const body = `fields id,name,abbreviation,alternative_name,platform_family.name,generation; sort name asc; limit ${limit}; offset ${offset};`;
    return igdbPost(clientId, token, "/platforms", body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// igdb_list_genres
export async function igdbListGenres(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getTwitchToken(clientId, clientSecret);

    const body = `fields id,name,slug,url; sort name asc; limit 50;`;
    return igdbPost(clientId, token, "/genres", body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// igdb_get_company
export async function igdbGetCompany(args: Record<string, unknown>): Promise<unknown> {
  try {
    const { clientId, clientSecret } = getCredentials(args);
    const token = await getTwitchToken(clientId, clientSecret);
    const name = String(args.name ?? "").trim();
    const companyId = String(args.company_id ?? "").trim();
    if (!name && !companyId) return { error: "Either name or company_id is required." };

    let body: string;
    if (companyId) {
      body = `fields id,name,description,developed.name,published.name,country,start_date,websites.url,logo.url; where id = ${companyId};`;
    } else {
      body = `fields id,name,description,developed.name,published.name,country,start_date,websites.url,logo.url; search "${name}"; limit 5;`;
    }

    const result = await igdbPost(clientId, token, "/companies", body) as Array<unknown>;
    return companyId ? (result[0] ?? { error: "Company not found." }) : result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
