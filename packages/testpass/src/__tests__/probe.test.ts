import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { probeServer } from "../probe.js";

function makeJsonRpcServer(
  handler: (method: string, params: unknown) => unknown | null
): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        const rpc = JSON.parse(body) as { id?: number; method: string; params: unknown };
        const result = handler(rpc.method, rpc.params);
        if (rpc.id === undefined) {
          res.writeHead(204).end();
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
  });
}

function makeStrictSseMcpServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const accept = req.headers.accept ?? "";
      if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
        res.writeHead(406, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Not Acceptable" } }));
        return;
      }

      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        const rpc = JSON.parse(body) as { id?: number; method: string };
        if (rpc.id === undefined) {
          res.writeHead(204).end();
          return;
        }

        const result = rpc.method === "tools/list"
          ? { tools: [{ name: "echo", description: "Echoes input" }] }
          : {
              protocolVersion: "2024-11-05",
              serverInfo: { name: "sse-test-server", version: "1.0.0" },
              capabilities: { tools: {} },
              instructions: "Test MCP server",
            };

        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result })}\n\n`);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
  });
}

describe("probeServer", () => {
  let srv: { url: string; close: () => void };

  beforeAll(async () => {
    srv = await makeJsonRpcServer((method) => {
      if (method === "initialize") {
        return {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "test-server", version: "1.0.0" },
          capabilities: { tools: {} },
          instructions: "Test MCP server",
        };
      }
      if (method === "tools/list") {
        return { tools: [{ name: "echo", description: "Echoes input" }] };
      }
      return null;
    });
  });

  afterAll(() => srv.close());

  it("returns protocolVersion and serverInfo", async () => {
    const result = await probeServer(srv.url);
    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.serverInfo.name).toBe("test-server");
  });

  it("returns tool list from tools/list", async () => {
    const result = await probeServer(srv.url);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("echo");
  });

  it("records latencyMs", async () => {
    const result = await probeServer(srv.url);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it("throws on unreachable server", async () => {
    await expect(probeServer("http://127.0.0.1:1", { timeoutMs: 500 })).rejects.toThrow();
  });

  it("sends MCP Accept header and parses SSE JSON-RPC responses", async () => {
    const strictSrv = await makeStrictSseMcpServer();
    try {
      const result = await probeServer(strictSrv.url);
      expect(result.serverInfo.name).toBe("sse-test-server");
      expect(result.tools[0].name).toBe("echo");
    } finally {
      strictSrv.close();
    }
  });
});
