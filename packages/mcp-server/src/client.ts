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
    // Resolve path params - e.g. /v1/webhook/:id/requests with { id: "abc" }
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

export function createClient(): UnClickClient {
  const apiKey = process.env.UNCLICK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "UNCLICK_API_KEY environment variable is not set. " +
        "Get your API key at https://unclick.world and set UNCLICK_API_KEY=<your-key>"
    );
  }
  const baseUrl =
    process.env.UNCLICK_BASE_URL ?? "https://api.unclick.world";
  return new UnClickClient({ apiKey, baseUrl });
}
