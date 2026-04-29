import { MCP_ACCEPT_HEADER, readMcpResponseBody } from "../mcp-http.js";

describe("mcp-http helpers", () => {
  it("requests both JSON and SSE MCP response formats", () => {
    expect(MCP_ACCEPT_HEADER).toContain("application/json");
    expect(MCP_ACCEPT_HEADER).toContain("text/event-stream");
  });

  it("parses JSON-RPC payloads from SSE message frames", async () => {
    const payload = { jsonrpc: "2.0", id: 1, result: { ok: true } };
    const res = new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      headers: { "Content-Type": "text/event-stream" },
    });

    await expect(readMcpResponseBody(res)).resolves.toEqual(payload);
  });
});
