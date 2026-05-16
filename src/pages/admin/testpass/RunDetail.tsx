import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ClipboardCopy, Download, Loader2, MessageSquare, Play, X } from "lucide-react";
import { useSession } from "@/lib/auth";
import { STATUS_LABEL, STATUS_PILL, elapsedLabel, fmtDate } from "./testpass-ui";

type VS = { check?: number; fail?: number; na?: number; other?: number; pending?: number };
type CardState = "pass" | "fail" | "warn" | "skip";

interface RunData {
  id: string;
  pack_name: string;
  target: { url?: string };
  profile: string;
  started_at: string;
  completed_at?: string;
  status: string;
  verdict_summary: VS;
  report_id?: string | null;
}

interface ReportBreadcrumb {
  id: string;
  target: string;
  run_sequence: string[];
}

interface CheckItem {
  id: string;
  check_id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  verdict: "check" | "na" | "fail" | "other" | "pending";
  on_fail_comment?: string | null;
  fix_recipe?: string[] | null;
  evidence_ref?: string | null;
  evidence_json?: unknown;
  evidence?: unknown;
}

const CARD_STYLE: Record<CardState, { icon: string; border: string; background: string; text: string; label: string }> = {
  pass: {
    icon: "✅",
    border: "border-emerald-400/35",
    background: "bg-emerald-400/[0.06]",
    text: "text-emerald-300",
    label: "Passed",
  },
  fail: {
    icon: "❌",
    border: "border-red-400/40",
    background: "bg-red-500/[0.07]",
    text: "text-red-300",
    label: "Needs fixing",
  },
  warn: {
    icon: "⚠️",
    border: "border-[#E2B93B]/45",
    background: "bg-[#E2B93B]/[0.08]",
    text: "text-[#E2B93B]",
    label: "Needs review",
  },
  skip: {
    icon: "⏸",
    border: "border-white/[0.12]",
    background: "bg-white/[0.04]",
    text: "text-gray-300",
    label: "Skipped",
  },
};

const SCORE_STYLE = {
  ok: "border-emerald-400/35 bg-emerald-400/[0.12] text-emerald-200",
  warn: "border-[#E2B93B]/40 bg-[#E2B93B]/[0.12] text-[#E2B93B]",
  fail: "border-red-400/40 bg-red-500/[0.12] text-red-200",
};

function useReportBreadcrumb(reportId: string | null | undefined, authHeader: Record<string, string>) {
  const [reportInfo, setReportInfo] = useState<ReportBreadcrumb | null>(null);

  useEffect(() => {
    if (!reportId) return;
    void fetch(`/api/memory-admin?action=get_report&report_id=${encodeURIComponent(reportId)}`, { headers: authHeader })
      .then((r) => r.json().catch(() => ({})))
      .then((body) => {
        if (body.report) {
          setReportInfo({
            id: body.report.id as string,
            target: body.report.target as string,
            run_sequence: body.report.run_sequence as string[],
          });
        }
      })
      .catch(() => undefined);
  }, [reportId, authHeader]);

  return reportInfo;
}

function cardState(verdict: CheckItem["verdict"]): CardState {
  if (verdict === "check") return "pass";
  if (verdict === "fail") return "fail";
  if (verdict === "other") return "warn";
  return "skip";
}

function statusLine(item: CheckItem) {
  if (item.verdict === "check") return "This check passed.";
  if (item.verdict === "fail") return item.on_fail_comment ?? "This check needs attention.";
  if (item.verdict === "other") return "This check needs a closer look.";
  if (item.verdict === "pending") return "This check has not finished yet.";
  return "This check was skipped for this run.";
}

function meaningLine(item: CheckItem) {
  if (item.on_fail_comment) return item.on_fail_comment;
  if (item.verdict === "check") return "TestPass found the expected result for this check.";
  if (item.verdict === "pending") return "TestPass is still waiting for this result.";
  if (item.verdict === "na") return "This check did not apply to the selected pack or target.";
  return "TestPass could not turn this result into a clean pass or fail yet.";
}

function rawEvidence(item: CheckItem) {
  return {
    check_id: item.check_id,
    category: item.category,
    severity: item.severity,
    verdict: item.verdict,
    evidence_ref: item.evidence_ref ?? null,
    evidence: item.evidence_json ?? item.evidence ?? null,
  };
}

function ScoreBadge({
  passed,
  total,
  severity,
  shareUrl,
  copied,
  onCopy,
}: {
  passed: number;
  total: number;
  severity: "ok" | "warn" | "fail";
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={!shareUrl}
      title={shareUrl ? "Copy share link" : "Share link is not ready"}
      className={`flex min-h-11 w-full min-w-[9rem] items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors sm:w-auto ${SCORE_STYLE[severity]} ${
        copied ? "ring-2 ring-emerald-300/50" : ""
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
      <span>{passed}/{total} passing</span>
    </button>
  );
}

function CheckCard({
  item,
  expanded,
  onToggle,
  copiedStep,
  onCopyStep,
}: {
  item: CheckItem;
  expanded: boolean;
  onToggle: () => void;
  copiedStep: string | null;
  onCopyStep: (stepKey: string, text: string) => void;
}) {
  const state = cardState(item.verdict);
  const style = CARD_STYLE[state];
  const steps = item.fix_recipe ?? [];
  const raw = rawEvidence(item);
  const hasRawEvidence = Boolean(raw.evidence_ref || raw.evidence);

  return (
    <article className={`rounded-lg border ${style.border} ${style.background} p-4`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-label={style.label} title={style.label}>
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-5 text-white">{item.title}</h2>
              <p className="mt-1 text-sm leading-5 text-[#d7d7d7]">{statusLine(item)}</p>
            </div>
            <span className={`shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[11px] font-medium ${style.text}`}>
              {style.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#61C1C4] hover:text-[#8bd9dc]"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide detail" : "Show detail"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-white/[0.08] pt-4">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#888]">What this means</p>
            <p className="mt-1 text-sm leading-6 text-[#d7d7d7]">{meaningLine(item)}</p>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#888]">How to fix</p>
            {steps.length > 0 ? (
              <ol className="mt-2 space-y-2">
                {steps.map((step, idx) => {
                  const stepKey = `${item.id}-${idx}`;
                  return (
                    <li key={stepKey} className="flex items-start gap-2 rounded-md border border-white/[0.08] bg-black/20 p-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-[#bbb]">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-5 text-[#d7d7d7]">{step}</span>
                      <button
                        type="button"
                        onClick={() => onCopyStep(stepKey, step)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#777] hover:bg-white/[0.08] hover:text-white"
                        title="Copy this step"
                      >
                        {copiedStep === stepKey ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-1 text-sm leading-6 text-[#d7d7d7]">
                {item.verdict === "fail" ? "Review this check, make the fix, then run TestPass again." : "No action needed."}
              </p>
            )}
          </section>

          {hasRawEvidence && (
            <details className="rounded-md border border-white/[0.08] bg-black/25 p-3">
              <summary className="cursor-pointer text-xs font-medium text-[#aaa]">See raw evidence</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-[#bbb]">
                {JSON.stringify(raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

export default function RunDetail() {
  const { id: runId } = useParams<{ id: string }>();
  const { session } = useSession();
  const navigate = useNavigate();
  const token = session?.access_token;
  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [run, setRun] = useState<RunData | null>(null);
  const reportBreadcrumb = useReportBreadcrumb(run?.report_id, authHeader);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedFixes, setCopiedFixes] = useState(false);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRun = useCallback(async () => {
    if (!runId || !token) {
      setLoading(false);
      return null;
    }
    try {
      const res = await fetch(`/api/memory-admin?action=get_testpass_run&run_id=${encodeURIComponent(runId)}`, { headers: authHeader });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to load run");
        return null;
      }
      setRun(body.run as RunData);
      setItems(Array.isArray(body.items) ? body.items as CheckItem[] : []);
      return (body.run as RunData).status;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load run");
      return null;
    } finally {
      setLoading(false);
    }
  }, [runId, token, authHeader]);

  useEffect(() => {
    const firstFetch = window.setTimeout(() => {
      void fetchRun().then((status) => {
        if (status === "running" || status === "pending") {
          pollRef.current = setInterval(() => {
            void fetchRun().then((s) => {
              if (s && s !== "running" && s !== "pending" && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            });
          }, 3000);
        }
      });
    }, 0);
    return () => {
      window.clearTimeout(firstFetch);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchRun]);

  const passedCount = run?.verdict_summary?.check ?? 0;
  const failCount = run?.verdict_summary?.fail ?? 0;
  const warnCount = run?.verdict_summary?.other ?? 0;
  const skippedCount = run?.verdict_summary?.na ?? 0;
  const pendingCount = run?.verdict_summary?.pending ?? 0;
  const totalFromSummary = passedCount + failCount + warnCount + skippedCount + pendingCount;
  const totalChecks = items.length || totalFromSummary;
  const scoreSeverity = failCount > 0 ? "fail" : warnCount + pendingCount > 0 ? "warn" : "ok";
  const failItems = items.filter((i) => i.verdict === "fail");
  const shareUrl = runId && typeof window !== "undefined" ? `${window.location.origin}/admin/testpass/runs/${runId}` : "";

  const agentPrompt = failItems.length > 0
    ? `I ran TestPass against ${run?.target?.url ?? "my MCP server"} and got ${failItems.length} failing check${failItems.length === 1 ? "" : "s"}:\n\n` +
      failItems.map((i) => `- ${i.title}\n  ${i.on_fail_comment ?? ""}`).join("\n") +
      "\n\nCan you help me fix these?"
    : `TestPass completed with no failures for ${run?.target?.url ?? "my MCP server"}.`;

  function toggleExpanded(itemId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1800);
  }

  async function copyFixList() {
    const text = failItems
      .map((i) => `## ${i.title}\n${i.on_fail_comment ?? ""}\n${(i.fix_recipe ?? []).map((s, n) => `  ${n + 1}. ${s}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedFixes(true);
    setTimeout(() => setCopiedFixes(false), 2500);
  }

  async function copyStep(stepKey: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedStep(stepKey);
    setTimeout(() => setCopiedStep(null), 1800);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[#888]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading run...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="py-24 text-center">
        <p className="mb-4 text-sm text-red-400">{error ?? "Run not found."}</p>
        <button onClick={() => navigate("/admin/testpass")} className="text-sm text-[#888] hover:text-white">
          Back to TestPass
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/admin/testpass")} className="flex items-center gap-1.5 text-sm text-[#888] hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All runs
        </button>
        <button
          onClick={() => navigate("/admin/testpass/new")}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-4 py-2 text-sm font-semibold text-[#E2B93B] hover:bg-[#E2B93B]/20"
        >
          <Play className="h-4 w-4" /> Run again
        </button>
      </div>

      {reportBreadcrumb && run.report_id && (
        <p className="text-xs text-[#666]">
          Run {(reportBreadcrumb.run_sequence.indexOf(runId ?? "") + 1) || "?"} of {reportBreadcrumb.run_sequence.length} in report for{" "}
          <Link to={`/admin/testpass/reports/${run.report_id}`} className="text-[#61C1C4] hover:underline">
            {reportBreadcrumb.target}
          </Link>
        </p>
      )}

      <section className="rounded-lg border border-white/[0.08] bg-[#101010] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL[run.status] ?? STATUS_PILL.pending}`}>
                {STATUS_LABEL[run.status] ?? run.status}
                {(run.status === "running" || run.status === "pending") && <Loader2 className="ml-1.5 inline-block h-3 w-3 animate-spin" />}
              </span>
              <span className="text-xs text-[#666]">{run.profile} depth</span>
            </div>
            <h1 className="text-xl font-semibold text-white">TestPass result</h1>
            <p className="mt-2 break-words font-mono text-sm text-[#aaa]">{run.target?.url ?? "(no URL)"}</p>
            <p className="mt-2 text-xs text-[#666]">
              Pack: <span className="text-[#ccc]">{run.pack_name}</span>
              <span className="mx-2 text-[#444]">|</span>
              Started: <span className="text-[#ccc]">{fmtDate(run.started_at)}</span>
              <span className="mx-2 text-[#444]">|</span>
              Elapsed: <span className="text-[#ccc]">{elapsedLabel(run.started_at, run.completed_at)}</span>
            </p>
          </div>
          <ScoreBadge
            passed={passedCount}
            total={totalChecks}
            severity={scoreSeverity}
            shareUrl={shareUrl}
            copied={copiedShare}
            onCopy={() => void copyShareLink()}
          />
        </div>

        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-5">
          {[
            ["Pass", passedCount, "text-emerald-300"],
            ["Fail", failCount, "text-red-300"],
            ["Review", warnCount, "text-[#E2B93B]"],
            ["Skipped", skippedCount, "text-gray-300"],
            ["Pending", pendingCount, "text-blue-300"],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
              <span className={`block text-lg font-bold ${color}`}>{value as number}</span>
              <span className="text-[#777]">{label as string}</span>
            </div>
          ))}
        </div>
      </section>

      {items.length === 0 ? (
        <section className="rounded-lg border border-white/[0.08] bg-[#111] px-6 py-12 text-center">
          <p className="text-base font-semibold text-white">No checks yet</p>
          <p className="mt-2 text-sm text-[#888]">This run is still getting ready. Results will appear here as soon as TestPass has them.</p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <CheckCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              onToggle={() => toggleExpanded(item.id)}
              copiedStep={copiedStep}
              onCopyStep={(stepKey, text) => void copyStep(stepKey, text)}
            />
          ))}
        </section>
      )}

      <div className="rounded-lg border border-white/[0.08] bg-[#111] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {failItems.length > 0 && (
              <button
                onClick={() => void copyFixList()}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
              >
                {copiedFixes ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copiedFixes ? "Copied" : "Copy fix list"}
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#888] hover:text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Ask your AI agent
            </button>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ run, items }, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `testpass-${runId?.slice(0, 8)}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#888] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/[0.08] bg-[#111] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Ask your AI agent</h3>
              <button onClick={() => setShowModal(false)} className="text-[#666] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-[#888]">Copy this prompt into your AI chat to get help with these checks.</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/40 p-3 text-[11px] text-[#ccc]">
              {agentPrompt}
            </pre>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(agentPrompt);
                setCopiedFixes(true);
                setTimeout(() => setCopiedFixes(false), 2500);
              }}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/10 px-3 py-2 text-xs text-[#61C1C4] hover:bg-[#61C1C4]/20"
            >
              {copiedFixes ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copiedFixes ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
