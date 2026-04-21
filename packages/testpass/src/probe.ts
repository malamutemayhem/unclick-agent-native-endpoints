/**
 * MCP probe - connects to an MCP server over HTTP and reads its tool list.
 *
 * Transport: HTTP POST to a single endpoint (simple JSON-RPC over HTTP).
 * SSE transport is out of scope for Chunk 2.
 */

export interface ProbeResult {
  protocolVersion: string;
  serverInfo: { name: string; version: string };
  capabilities: Record<string, unknown>;
  tools: ToolEntry[];
  instructions?: string;
  latencyMs: number;
}

export interface ToolEntry {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface ProbeOptions {
  timeoutMs?: number;
  clientName?: string;
  clientVersion?: string;
}

class JsonRpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "JsonRpcError";
  }
}

async function rpc(
  url: string,
  method: string,
  params: unknown,
  id: number | null,
  timeoutMs: number
): Promise<unknown> {
  const body: Record<string, unknown> = { jsonrpc: "2.0", method, params };
  if (id !== null) body.id = id;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from MCP server`);
    }
    if (id === null) return null; // notification - no response expected
    const data = (await res.json()) as {
      result?: unknown;
      error?: { code: number; message: string };
    };
    if (data.error) throw new JsonRpcError(data.error.code, data.error.message);
    return data.result;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Probe an MCP server: initialize, list tools, return structured evidence.
 */
export async function probeServer(url: string, opts: ProbeOptions = {}): Promise<ProbeResult> {
  const { timeoutMs = 10_000, clientName = "testpass-probe", clientVersion = "0.1.0" } = opts;
  const start = Date.now();

  const initResult = (await rpc(
    url,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      clientInfo: { name: clientName, version: clientVersion },
      capabilities: {},
    },
    1,
    timeoutMs
  )) as {
    protocolVersion: string;
    serverInfo?: { name: string; version: string };
    capabilities?: Record<string, unknown>;
    instructions?: string;
  };

  // Send initialized notification (no id = notification, no response expected)
  await rpc(url, "notifications/initialized", {}, null, timeoutMs).catch(() => {
    // Servers that don't accept POSTs for notifications return errors; ignore.
  });

  // List tools if capability declared
  let tools: ToolEntry[] = [];
  if (initResult.capabilities?.tools !== undefined) {
    const listResult = (await rpc(url, "tools/list", {}, 2, timeoutMs)) as {
      tools?: ToolEntry[];
    };
    tools = listResult?.tools ?? [];
  }

  return {
    protocolVersion: initResult.protocolVersion,
    serverInfo: initResult.serverInfo ?? { name: "unknown", version: "unknown" },
    capabilities: initResult.capabilities ?? {},
    tools,
    instructions: initResult.instructions,
    latencyMs: Date.now() - start,
  };
}
