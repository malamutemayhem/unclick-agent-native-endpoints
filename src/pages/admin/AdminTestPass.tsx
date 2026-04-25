/**
 * AdminTestPass - TestPass admin surface (/admin/testpass)
 *
 * Sections:
 *   1. Pack editor  - CodeMirror 6 YAML with Validate + Save Pack
 *   2. Run controls - Target URL + Profile, POSTs run, polls status
 *   3. Results table - items filterable by All / Fail only
 *   4. Copy Fix List - GET report_md and copy markdown to clipboard
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import yaml from "js-yaml";
import { useSession } from "@/lib/auth";
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  FlaskConical,
  Loader2,
  Play,
  Save,
} from "lucide-react";

// Kept in sync with packages/testpass/packs/testpass-core.yaml so the
// editor pre-fills with a valid baseline pack the user can tweak.
const DEFAULT_PACK_YAML = `id: testpass-core
name: TestPass Core v0
version: 0.1.0
description: >
  Baseline conformance checks for MCP servers. Covers JSON-RPC 2.0
  wire-protocol correctness (deterministic) and MCP lifecycle compliance
  (agent-assisted). No LLM calls required for the RPC items.

items:
  # JSON-RPC 2.0 baseline - deterministic (no LLM needed)
  - id: RPC-001
    title: Request must include jsonrpc field set to "2.0"
    category: json-rpc
    severity: critical
    check_type: deterministic
    description: Every request object must contain the field "jsonrpc" with the exact string value "2.0".
    expected: { field: jsonrpc, value: "2.0" }
    on_fail: Server is not JSON-RPC 2.0 compliant. Verify the framework sets jsonrpc correctly.
    tags: [wire-protocol, mandatory]
    profiles: [smoke, standard, deep]

  - id: RPC-002
    title: Request must include an id field (non-null for requests expecting a response)
    category: json-rpc
    severity: high
    check_type: deterministic
    description: Request objects that expect a response must carry an id (string, number, or null). Notifications omit id.
    on_fail: Missing id causes client correlation failures.
    tags: [wire-protocol, mandatory]
    profiles: [smoke, standard, deep]

  - id: RPC-003
    title: Error response must include code and message fields
    category: json-rpc
    severity: high
    check_type: deterministic
    description: When a method call fails, the error object must contain integer code and string message.
    expected: { error_shape: { code: integer, message: string } }
    on_fail: Clients cannot reliably detect or classify errors without a conformant error object.
    tags: [wire-protocol, error-handling]
    profiles: [smoke, standard, deep]

  - id: RPC-004
    title: Method not found returns error code -32601
    category: json-rpc
    severity: high
    check_type: deterministic
    description: Calling a method that does not exist must return error code -32601 (Method not found).
    expected: { error_code: -32601 }
    on_fail: Non-standard error codes break generic JSON-RPC client error handling.
    tags: [wire-protocol, error-handling]
    profiles: [smoke, standard, deep]

  - id: RPC-005
    title: Batch requests return an array of responses
    category: json-rpc
    severity: medium
    check_type: deterministic
    description: A JSON array of request objects must be handled as a batch and return a JSON array of response objects.
    on_fail: Batch support is optional per spec but must not crash the server.
    tags: [wire-protocol, batch]
    profiles: [standard, deep]

  - id: RPC-006
    title: Notification (no id) must not return a response
    category: json-rpc
    severity: medium
    check_type: deterministic
    description: A request object without an id field is a notification. The server must not return a response object.
    on_fail: Returning a response to a notification wastes bandwidth and may confuse clients.
    tags: [wire-protocol, notifications]
    profiles: [standard, deep]

  # MCP lifecycle - agent-assisted
  - id: MCP-001
    title: Server responds to initialize with a valid InitializeResult
    category: mcp-lifecycle
    severity: critical
    check_type: agent
    description: >
      Call the initialize method with a valid ClientInfo and ProtocolVersion.
      The server must respond with serverInfo, protocolVersion, and capabilities.
    on_fail: Without a valid InitializeResult the MCP handshake cannot complete.
    tags: [lifecycle, handshake]
    profiles: [smoke, standard, deep]

  - id: MCP-002
    title: Server returns non-empty instructions in InitializeResult
    category: mcp-lifecycle
    severity: medium
    check_type: agent
    description: InitializeResult.instructions should be a non-empty string describing server capabilities and usage.
    on_fail: Missing instructions means agents cannot self-orient without external documentation.
    tags: [lifecycle, documentation]
    profiles: [standard, deep]

  - id: MCP-003
    title: Server declares at least one capability in InitializeResult
    category: mcp-lifecycle
    severity: high
    check_type: agent
    description: InitializeResult.capabilities must declare at least one of tools, resources, or prompts.
    on_fail: A server with no declared capabilities provides no value to the agent.
    tags: [lifecycle, capabilities]
    profiles: [smoke, standard, deep]

  - id: MCP-004
    title: Server accepts and does not error on initialized notification
    category: mcp-lifecycle
    severity: high
    check_type: agent
    description: >
      After initialize, the client must send the initialized notification.
      The server must not return an error or close the connection.
    on_fail: Rejecting the initialized notification breaks spec-compliant clients.
    tags: [lifecycle, handshake]
    profiles: [smoke, standard, deep]

  - id: MCP-005
    title: Server responds to ping with an empty result
    category: mcp-lifecycle
    severity: medium
    check_type: agent
    description: The ping method must return an empty result object {} within 5 seconds.
    expected: { max_latency_ms: 5000 }
    on_fail: Slow or missing ping breaks liveness probes in agent frameworks.
    tags: [lifecycle, health]
    profiles: [standard, deep]

  - id: MCP-006
    title: Unknown method returns error, does not crash server
    category: mcp-lifecycle
    severity: high
    check_type: agent
    description: >
      Calling a method name not in the server's declared tools/resources/prompts
      must return a JSON-RPC error (code -32601) and leave the server alive for
      subsequent calls.
    expected: { error_code: -32601 }
    on_fail: A crash on unknown methods makes the server unusable after the first agent exploration call.
    tags: [lifecycle, resilience, error-handling]
    profiles: [smoke, standard, deep]
`;

interface RunItem {
  check_id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  verdict: "check" | "na" | "fail" | "other" | "pending";
  on_fail_comment?: string | null;
}

interface VerdictSummary {
  total: number;
  check: number;
  na: number;
  fail: number;
  other: number;
  pending: number;
  pass_rate: number;
}

const VERDICT_BADGES: Record<string, string> = {
  check:   "bg-[#61C1C4]/10 text-[#61C1C4] border-[#61C1C4]/30",
  na:      "bg-gray-500/10 text-gray-400 border-gray-500/30",
  fail:    "bg-red-500/10 text-red-400 border-red-500/30",
  other:   "bg-[#E2B93B]/10 text-[#E2B93B] border-[#E2B93B]/30",
  pending: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: "bg-red-600/10 text-red-400 border-red-600/30",
  high:     "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium:   "bg-[#E2B93B]/10 text-[#E2B93B] border-[#E2B93B]/30",
  low:      "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export default function AdminTestPass() {
  const { session } = useSession();
  const token = session?.access_token;
  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  // ─── Pack editor ────────────────────────────────────────────────
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef      = useRef<EditorView | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateOk,    setValidateOk]    = useState(false);
  const [savingPack,    setSavingPack]    = useState(false);
  const [savePackMsg,   setSavePackMsg]   = useState<string | null>(null);

  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) return;
    const state = EditorState.create({
      doc: DEFAULT_PACK_YAML,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        yamlLang(),
        EditorView.theme(
          {
            "&":                   { backgroundColor: "#0a0a0a", color: "#ccc", fontSize: "12px", height: "420px" },
            ".cm-scroller":        { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
            ".cm-gutters":         { backgroundColor: "#0a0a0a", color: "#555", border: "none" },
            ".cm-activeLine":      { backgroundColor: "rgba(255,255,255,0.02)" },
            ".cm-activeLineGutter":{ backgroundColor: "rgba(255,255,255,0.02)" },
            ".cm-content":         { caretColor: "#61C1C4" },
            ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#61C1C4" },
          },
          { dark: true },
        ),
      ],
    });
    editorViewRef.current = new EditorView({ state, parent: editorContainerRef.current });
    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
  }, []);

  const getPackYaml = () => editorViewRef.current?.state.doc.toString() ?? "";

  function validateYaml() {
    setSavePackMsg(null);
    try {
      const parsed = yaml.load(getPackYaml());
      if (!parsed || typeof parsed !== "object") throw new Error("YAML must parse to an object");
      const p = parsed as Record<string, unknown>;
      if (!p.id || !p.name || !p.version || !Array.isArray(p.items)) {
        throw new Error("Pack must have id, name, version, and items[]");
      }
      setValidateError(null);
      setValidateOk(true);
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : "Invalid YAML");
      setValidateOk(false);
    }
  }

  async function savePack() {
    setSavingPack(true);
    setSavePackMsg(null);
    try {
      const res = await fetch("/api/testpass", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "save_pack", pack_yaml: getPackYaml() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Save failed with ${res.status}`);
      setSavePackMsg(`Saved pack ${body.pack?.slug ?? ""}`);
    } catch (err) {
      setSavePackMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingPack(false);
    }
  }

  // ─── Run controls ───────────────────────────────────────────────
  const [targetUrl,  setTargetUrl]  = useState("");
  const [profile,    setProfile]    = useState<"smoke" | "standard" | "deep">("standard");
  const [running,    setRunning]    = useState(false);
  const [runId,      setRunId]      = useState<string | null>(null);
  const [runStatus,  setRunStatus]  = useState<string | null>(null);
  const [runError,   setRunError]   = useState<string | null>(null);
  const [items,      setItems]      = useState<RunItem[]>([]);
  const [summary,    setSummary]    = useState<VerdictSummary | null>(null);
  const [filterFail, setFilterFail] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const pollRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  useEffect(() => () => clearPoll(), [clearPoll]);

  const fetchStatus = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/testpass?action=status&run_id=${encodeURIComponent(id)}`, {
        headers: authHeader,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Status failed with ${res.status}`);
      setRunStatus(body.run?.status ?? null);
      setItems(body.items ?? []);
      setSummary(body.run?.verdict_summary ?? null);
      return (body.run?.status as string | null) ?? null;
    },
    [authHeader],
  );

  async function runPack() {
    if (!targetUrl) { setRunError("Target URL is required"); return; }
    setRunning(true);
    setRunError(null);
    setItems([]);
    setSummary(null);
    setRunId(null);
    setRunStatus(null);
    clearPoll();
    try {
      const res = await fetch("/api/testpass", {
        method:  "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body:    JSON.stringify({
          action: "run",
          target_url: targetUrl,
          profile,
          pack_slug: "testpass-core",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Run failed with ${res.status}`);
      const id = body.run_id as string;
      setRunId(id);
      const initial = await fetchStatus(id);
      if (initial === "running") {
        pollRef.current = window.setInterval(() => {
          fetchStatus(id)
            .then((s) => { if (s && s !== "running") clearPoll(); })
            .catch((e) => {
              clearPoll();
              setRunError(e instanceof Error ? e.message : "Poll failed");
            });
        }, 3_000);
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function copyFixList() {
    if (!runId) return;
    try {
      const res = await fetch(`/api/testpass?action=report_md&run_id=${encodeURIComponent(runId)}`, {
        headers: authHeader,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Report failed with ${res.status}`);
      await navigator.clipboard.writeText(body.markdown ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3_000);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Copy failed");
    }
  }

  const failCount = items.filter((i) => i.verdict === "fail").length;
  const visibleItems = filterFail ? items.filter((i) => i.verdict === "fail") : items;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-[#61C1C4]" />
        <div>
          <h1 className="text-2xl font-semibold text-white">TestPass</h1>
          <p className="mt-1 text-sm text-[#888]">
            Checks your MCP server speaks the protocol correctly. Edit a pack, run it against a target, export fixes.
          </p>
        </div>
      </div>

      {/* Section 1 - Pack editor */}
      <section className="mb-8 rounded-xl border border-white/[0.06] bg-[#111111] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Pack editor</h2>
        <div ref={editorContainerRef} className="overflow-hidden rounded-lg border border-white/[0.06]" />
        {validateError && (
          <p className="mt-3 flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-pre-wrap font-mono">{validateError}</span>
          </p>
        )}
        {validateOk && !validateError && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#61C1C4]">
            <Check className="h-3.5 w-3.5" /> YAML parses, schema looks good.
          </p>
        )}
        {savePackMsg && <p className="mt-2 text-xs text-[#E2B93B]">{savePackMsg}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={validateYaml}
            className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs font-medium text-[#ccc] transition-colors hover:border-[#61C1C4]/30 hover:text-[#61C1C4]"
          >
            Validate YAML
          </button>
          <button
            onClick={() => void savePack()}
            disabled={savingPack}
            className="flex items-center gap-2 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-2 text-xs font-medium text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20 disabled:opacity-50"
          >
            {savingPack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Pack
          </button>
        </div>
      </section>

      {/* Section 2 - Run controls */}
      <section className="mb-8 rounded-xl border border-white/[0.06] bg-[#111111] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Run</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            placeholder="https://api.example.com/mcp"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#61C1C4]/40 focus:outline-none"
          />
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value as "smoke" | "standard" | "deep")}
            className="rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#61C1C4]/40 focus:outline-none"
          >
            <option value="smoke">smoke</option>
            <option value="standard">standard</option>
            <option value="deep">deep</option>
          </select>
          <button
            onClick={() => void runPack()}
            disabled={running || !targetUrl}
            className="flex items-center gap-2 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-3 py-2 text-xs font-semibold text-[#E2B93B] transition-colors hover:bg-[#E2B93B]/20 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run TestPass
          </button>
        </div>
        {runError && <p className="mt-3 text-xs text-red-400">{runError}</p>}
        {runId && (
          <p className="mt-3 text-[11px] text-[#666]">
            Run <span className="font-mono text-[#888]">{runId}</span>
            {runStatus && <> · status <span className="text-[#ccc]">{runStatus}</span></>}
            {runStatus === "running" && <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin text-[#E2B93B]" />}
          </p>
        )}
      </section>

      {/* Section 3 - Results */}
      {items.length > 0 && (
        <section className="mb-8 rounded-xl border border-white/[0.06] bg-[#111111] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Results</h2>
            <div className="flex flex-wrap items-center gap-3">
              {summary && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#888]">
                  <span className="font-mono text-[#61C1C4]">{(summary.pass_rate * 100).toFixed(0)}%</span>
                  <span>·</span>
                  <span>total <span className="text-[#ccc]">{summary.total}</span></span>
                  <span>·</span>
                  <span>check <span className="text-[#61C1C4]">{summary.check}</span></span>
                  <span>·</span>
                  <span>fail <span className="text-red-400">{summary.fail}</span></span>
                  <span>·</span>
                  <span>na <span className="text-gray-400">{summary.na}</span></span>
                  <span>·</span>
                  <span>other <span className="text-[#E2B93B]">{summary.other}</span></span>
                </div>
              )}
              <div className="flex items-center gap-1 rounded-md border border-white/[0.06] p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterFail(false)}
                  className={`rounded px-2 py-1 ${!filterFail ? "bg-white/[0.06] text-white" : "text-[#888]"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterFail(true)}
                  className={`rounded px-2 py-1 ${filterFail ? "bg-red-500/10 text-red-400" : "text-[#888]"}`}
                >
                  Fail only
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[#666]">
                  <th className="py-2 pr-3 font-medium">check_id</th>
                  <th className="py-2 pr-3 font-medium">title</th>
                  <th className="py-2 pr-3 font-medium">category</th>
                  <th className="py-2 pr-3 font-medium">severity</th>
                  <th className="py-2 pr-3 font-medium">verdict</th>
                  <th className="py-2 pr-3 font-medium">on_fail_comment</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) => (
                  <tr key={it.check_id} className="border-b border-white/[0.04]">
                    <td className="py-2 pr-3 font-mono text-[#ccc]">{it.check_id}</td>
                    <td className="py-2 pr-3 text-[#aaa]">{it.title}</td>
                    <td className="py-2 pr-3 text-[#888]">{it.category}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${SEVERITY_BADGES[it.severity] ?? ""}`}>
                        {it.severity}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${VERDICT_BADGES[it.verdict] ?? ""}`}>
                        {it.verdict}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[#777]">{it.on_fail_comment ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleItems.length === 0 && (
              <p className="py-6 text-center text-xs text-[#666]">No items to show.</p>
            )}
          </div>
        </section>
      )}

      {/* Section 4 - Copy Fix List */}
      {failCount > 0 && runId && (
        <section className="mb-8 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-red-400">
                {failCount} failing check{failCount === 1 ? "" : "s"}
              </h2>
              <p className="mt-1 text-xs text-[#888]">
                Export a markdown fix list to paste into a GitHub issue or agent prompt.
              </p>
            </div>
            <button
              onClick={() => void copyFixList()}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? "Fix list copied" : "Copy Fix List"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
