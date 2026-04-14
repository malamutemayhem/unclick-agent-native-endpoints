import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface UnClickConfig {
  apiKey: string;
  baseUrl: string;
}

export class UnClickClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: UnClickConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async call(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    // Resolve path params — e.g. /v1/webhook/:id/requests with { id: "abc" }
    // We handle this by substituting :param tokens from the body, then removing them from body
    let resolvedPath = path;
    const remainingBody: Record<string, unknown> = { ...body };

    const paramMatches = path.match(/:([a-zA-Z_]+)/g);
    if (paramMatches) {
      for (const match of paramMatches) {
        const paramName = match.slice(1);
        if (remainingBody[paramName] !== undefined) {
          resolvedPath = resolvedPath.replace(match, String(remainingBody[paramName]));
          delete remainingBody[paramName];
        }
      }
    }

    const url = `${this.baseUrl}${resolvedPath}`;
    const isGet = method.toUpperCase() === "GET";
    const isDelete = method.toUpperCase() === "DELETE";

    const fetchUrl =
      isGet && body && Object.keys(remainingBody).length > 0
        ? `${url}?${new URLSearchParams(
            Object.fromEntries(
              Object.entries(remainingBody).map(([k, v]) => [k, String(v)])
            )
          )}`
        : url;

    const response = await fetch(fetchUrl, {
      method: method.toUpperCase(),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body:
        !isGet && !isDelete && body && Object.keys(remainingBody).length > 0
          ? JSON.stringify(remainingBody)
          : undefined,
    });

    // Handle non-JSON responses (e.g. QR code PNG)
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`UnClick API error ${response.status}: ${await response.text()}`);
      }
      // Return binary as base64 for MCP text transport
      const buffer = await response.arrayBuffer();
      return {
        binary: true,
        content_type: contentType,
        data: Buffer.from(buffer).toString("base64"),
      };
    }

    const data = await response.json();
    if (!response.ok) {
      const msg =
        (data as { message?: string; error?: string })?.message ??
        (data as { message?: string; error?: string })?.error ??
        `HTTP ${response.status}`;
      throw new Error(`UnClick API error: ${msg}`);
    }
    return data;
  }
}

// ─── Install ticket handoff ────────────────────────────────────────────────
//
// Users paste a ticket like "unclick-ember-falcon-2847" instead of a raw API
// key. On first boot the server redeems the ticket for the real key and
// caches it so subsequent boots skip the round trip.

const TICKET_RE = /^unclick-[a-z]+-[a-z]+-\d{4}$/;
const API_KEY_RE = /^uc_[a-f0-9]{16,}$/;

function cacheFilePath(): string {
  const dir = path.join(os.homedir(), ".unclick");
  return path.join(dir, "credentials.json");
}

function readCachedApiKey(ticket: string): string | null {
  try {
    const raw = fs.readFileSync(cacheFilePath(), "utf8");
    const parsed = JSON.parse(raw) as { tickets?: Record<string, string> };
    return parsed.tickets?.[ticket] ?? null;
  } catch {
    return null;
  }
}

function writeCachedApiKey(ticket: string, apiKey: string): void {
  try {
    const file = cacheFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    let existing: { tickets?: Record<string, string> } = {};
    try {
      existing = JSON.parse(fs.readFileSync(file, "utf8")) as typeof existing;
    } catch {
      existing = {};
    }
    existing.tickets = { ...(existing.tickets ?? {}), [ticket]: apiKey };
    fs.writeFileSync(file, JSON.stringify(existing, null, 2), { mode: 0o600 });
  } catch (err) {
    // Non-fatal: we can still use the key in memory for this session.
    process.stderr.write(
      `[UnClick] Could not cache API key (${String(err)}). You may need to redeem a new ticket next boot.\n`,
    );
  }
}

async function redeemTicket(ticket: string, baseUrl: string): Promise<string> {
  const redeemUrl = `${baseUrl.replace(/\/$/, "")}/api/install-ticket`;
  const response = await fetch(redeemUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "redeem", ticket }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    api_key?: string;
    error?: string;
  };
  if (!response.ok || !data.api_key) {
    throw new Error(
      data.error ??
        `Could not redeem install ticket (HTTP ${response.status}). Get a fresh one at https://unclick.world/i`,
    );
  }
  return data.api_key;
}

async function resolveApiKey(raw: string, webBaseUrl: string): Promise<string> {
  if (API_KEY_RE.test(raw)) return raw;
  if (!TICKET_RE.test(raw)) {
    // Unknown shape; trust the user and pass it through unchanged.
    return raw;
  }
  const cached = readCachedApiKey(raw);
  if (cached) return cached;
  const apiKey = await redeemTicket(raw, webBaseUrl);
  writeCachedApiKey(raw, apiKey);
  return apiKey;
}

let resolvedKeyCache: Promise<string> | null = null;

async function getApiKey(): Promise<string> {
  const raw = process.env.UNCLICK_API_KEY;
  if (!raw) {
    throw new Error(
      "UNCLICK_API_KEY environment variable is not set. " +
        "Get your install config at https://unclick.world",
    );
  }
  if (!resolvedKeyCache) {
    const webBaseUrl =
      process.env.UNCLICK_WEB_URL ?? "https://unclick.world";
    resolvedKeyCache = resolveApiKey(raw, webBaseUrl);
  }
  return resolvedKeyCache;
}

export function createClient(): UnClickClient {
  const baseUrl = process.env.UNCLICK_BASE_URL ?? "https://api.unclick.world";
  // Returns a client whose apiKey is filled in lazily on the first call.
  const client = new UnClickClient({ apiKey: "", baseUrl });
  const originalCall = client.call.bind(client);
  client.call = async (method, path, body) => {
    const apiKey = await getApiKey();
    (client as unknown as { apiKey: string }).apiKey = apiKey;
    return originalCall(method, path, body);
  };
  return client;
}
