import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { runDeterministicChecks } from "../runner/deterministic.js";
import * as runManager from "../run-manager.js";
import { loadPackFromYaml } from "../pack-loader.js";

// ─── Mock the DB layer ────────────────────────────────────────────────────
jest.mock("../run-manager.js", () => ({
  updateItem:     jest.fn().mockResolvedValue(undefined),
  createEvidence: jest.fn().mockResolvedValue("evidence-id-stub"),
}));

const mockUpdateItem     = runManager.updateItem     as jest.Mock;
const mockCreateEvidence = runManager.createEvidence as jest.Mock;

// ─── Mock MCP server ──────────────────────────────────────────────────────

function makeMockMcpServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      let raw = "";
      req.on("data", (c: Buffer) => (raw += c.toString()));
      req.on("end", () => {
        // Batch request
        if (raw.trimStart().startsWith("[")) {
          const batch = JSON.parse(raw) as Array<{ id?: number; method: string }>;
          const responses = batch
            .filter((r) => r.id !== undefined)
            .map((r) => ({ jsonrpc: "2.0", id: r.id, result: mockResult(r.method) }));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(responses));
          return;
        }

        const rpc = JSON.parse(raw) as { id?: number; method: string; params?: unknown };

        // Notification: no id
        if (rpc.id === undefined) {
          res.writeHead(204).end();
          return;
        }

        const result = mockResult(rpc.method);
        if (result === "__ERROR__") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id:      rpc.id,
            error:   { code: -32601, message: "Method not found" },
          }));
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

function mockResult(method: string): unknown {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      serverInfo:      { name: "test-mcp", version: "1.0.0" },
      capabilities:    { tools: {} },
      instructions:    "Test MCP server for TestPass",
    };
  }
  if (method === "ping") return {};
  return "__ERROR__";
}

// ─── Minimal pack fixture ─────────────────────────────────────────────────

const PACK_YAML = `
id: testpass-core
name: TestPass Core v0
version: 0.1.0
items:
  - id: RPC-001
    title: jsonrpc field
    category: json-rpc
    severity: critical
    check_type: deterministic
  - id: RPC-002
    title: id echo
    category: json-rpc
    severity: high
    check_type: deterministic
  - id: RPC-003
    title: error shape
    category: json-rpc
    severity: high
    check_type: deterministic
  - id: RPC-004
    title: method not found code
    category: json-rpc
    severity: high
    check_type: deterministic
  - id: RPC-005
    title: batch support
    category: json-rpc
    severity: medium
    check_type: deterministic
  - id: RPC-006
    title: notification no response
    category: json-rpc
    severity: medium
    check_type: deterministic
  - id: MCP-001
    title: initialize result
    category: mcp-lifecycle
    severity: critical
    check_type: agent
  - id: MCP-002
    title: instructions
    category: mcp-lifecycle
    severity: medium
    check_type: agent
  - id: MCP-003
    title: capabilities
    category: mcp-lifecycle
    severity: high
    check_type: agent
  - id: MCP-004
    title: initialized notification
    category: mcp-lifecycle
    severity: high
    check_type: agent
  - id: MCP-005
    title: ping
    category: mcp-lifecycle
    severity: medium
    check_type: agent
  - id: MCP-006
    title: unknown method
    category: mcp-lifecycle
    severity: high
    check_type: agent
`;

// ─── Tests ────────────────────────────────────────────────────────────────

describe("runDeterministicChecks", () => {
  let srv: { url: string; close: () => void };
  const config = { supabaseUrl: "http://unused", serviceRoleKey: "unused" };
  const pack   = loadPackFromYaml(PACK_YAML);

  beforeAll(async () => { srv = await makeMockMcpServer(); });
  afterAll(() => srv.close());
  beforeEach(() => { jest.clearAllMocks(); });

  it("calls updateItem for all 12 items", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    expect(mockUpdateItem).toHaveBeenCalledTimes(12);
  });

  it("passes RPC-001 (jsonrpc field)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-001");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes RPC-002 (id echo)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-002");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes RPC-003 (error shape)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-003");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes RPC-004 (method not found = -32601)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-004");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes or marks na RPC-005 (batch)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-005");
    expect(["check", "na"]).toContain(call?.[3].verdict);
  });

  it("passes RPC-006 (notification no response)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "RPC-006");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-001 (initialize result shape)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-001");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-002 (instructions non-empty)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-002");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-003 (capabilities declared)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-003");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-004 (initialized notification accepted)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-004");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-005 (ping returns empty result)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-005");
    expect(call?.[3].verdict).toBe("check");
  });

  it("passes MCP-006 (unknown method = -32601)", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    const call = mockUpdateItem.mock.calls.find((c) => c[2] === "MCP-006");
    expect(call?.[3].verdict).toBe("check");
  });

  it("records evidence for every check", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    expect(mockCreateEvidence).toHaveBeenCalledTimes(12);
    expect(mockCreateEvidence.mock.calls[0][1].kind).toBe("http_trace");
  });

  it("records time_ms and zero cost_usd on each item", async () => {
    await runDeterministicChecks(config, "run-1", srv.url, pack, "standard");
    for (const call of mockUpdateItem.mock.calls) {
      expect(typeof call[3].time_ms).toBe("number");
      expect(call[3].cost_usd).toBe(0);
    }
  });

  it("marks verdict other on unreachable server", async () => {
    await runDeterministicChecks(config, "run-bad", "http://127.0.0.1:1", pack, "standard");
    for (const call of mockUpdateItem.mock.calls) {
      expect(["other", "fail"]).toContain(call[3].verdict);
    }
  });

  it("skips smoke-only items when running with deep profile", async () => {
    const smokeOnlyYaml = `
id: test
name: Test
version: 0.1.0
items:
  - id: RPC-001
    title: rpc
    category: json-rpc
    severity: critical
    check_type: deterministic
    profiles: [smoke]
`;
    const smokePack = loadPackFromYaml(smokeOnlyYaml);
    await runDeterministicChecks(config, "run-2", srv.url, smokePack, "deep");
    expect(mockUpdateItem).toHaveBeenCalledTimes(0);
  });
});
