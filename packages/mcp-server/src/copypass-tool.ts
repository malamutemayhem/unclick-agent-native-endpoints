import { randomUUID } from "node:crypto";

type Verdict = "check" | "na" | "fail" | "other" | "pending";
type Severity = "critical" | "high" | "medium" | "low";
type RunStatus = "queued" | "running" | "complete" | "failed";
type RunProfile = "smoke" | "standard" | "deep";

interface VerdictSummary {
  total: number;
  check: number;
  na: number;
  fail: number;
  other: number;
  pending: number;
  pass_rate: number;
}

interface CopyFinding {
  id: string;
  check_id: string;
  title: string;
  severity: Severity;
  verdict: Verdict;
  category: string;
  description?: string;
  remediation?: string;
  evidence: Record<string, unknown>;
  created_at: string;
}

interface CopyRunRecord {
  id: string;
  profile: RunProfile;
  status: RunStatus;
  target: {
    type: "copy";
    copy_text_preview: string;
    channel?: string;
    audience?: string;
    goal?: string;
  };
  verdict_summary: VerdictSummary;
  created_at: string;
  completed_at: string | null;
  findings: CopyFinding[];
  notes: string[];
  error?: string;
}

const RUNS = new Map<string, CopyRunRecord>();

function emptySummary(): VerdictSummary {
  return { total: 0, check: 0, na: 0, fail: 0, other: 0, pending: 0, pass_rate: 0 };
}

function parseProfile(raw: unknown): RunProfile | null {
  if (raw === undefined || raw === null || raw === "") return "smoke";
  return raw === "smoke" || raw === "standard" || raw === "deep" ? raw : null;
}

function previewCopy(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}...` : oneLine;
}

function summarize(findings: CopyFinding[]): VerdictSummary {
  const summary = emptySummary();
  summary.total = findings.length;
  for (const finding of findings) {
    summary[finding.verdict] += 1;
  }
  const decided = summary.check + summary.na + summary.fail + summary.other;
  summary.pass_rate = decided > 0 ? summary.check / decided : 0;
  return summary;
}

function createRunRecord(copyText: string, profile: RunProfile, args: Record<string, unknown>): CopyRunRecord {
  const record: CopyRunRecord = {
    id: randomUUID(),
    profile,
    status: "queued",
    target: {
      type: "copy",
      copy_text_preview: previewCopy(copyText),
      channel: typeof args.channel === "string" ? args.channel : undefined,
      audience: typeof args.audience === "string" ? args.audience : undefined,
      goal: typeof args.goal === "string" ? args.goal : undefined,
    },
    verdict_summary: emptySummary(),
    created_at: new Date().toISOString(),
    completed_at: null,
    findings: [],
    notes: [],
  };
  RUNS.set(record.id, record);
  return record;
}

function appendScaffoldFinding(runId: string, copyText: string): void {
  const current = RUNS.get(runId);
  if (!current) return;
  current.findings.push({
    id: randomUUID(),
    check_id: "copypass.scaffold.placeholder",
    title: "CopyPass scaffold is wired, but automated copy checks have not landed yet",
    severity: "low",
    verdict: "na",
    category: "scaffold",
    description:
      "This run proves the CopyPass MCP and admin surface are connected. Evidence-led copy checks land in a later chunk.",
    remediation:
      "Use this scaffold to test routing, entitlement, and UI placement now. Add deterministic copy checks before calling the result a real verdict.",
    evidence: {
      copy_length: copyText.length,
      preview: previewCopy(copyText),
      channel: current.target.channel ?? null,
      audience: current.target.audience ?? null,
      goal: current.target.goal ?? null,
    },
    created_at: new Date().toISOString(),
  });
  current.verdict_summary = summarize(current.findings);
  RUNS.set(runId, current);
}

function appendNote(runId: string, note: string): void {
  const current = RUNS.get(runId);
  if (!current) return;
  current.notes.push(note);
  RUNS.set(runId, current);
}

export async function copypassRun(args: Record<string, unknown>): Promise<unknown> {
  const copyText = typeof args.copy_text === "string" ? args.copy_text.trim() : "";
  if (!copyText) return { error: "copy_text is required" };
  const profile = parseProfile(args.profile);
  if (!profile) return { error: "profile must be one of: smoke, standard, deep" };

  const run = createRunRecord(copyText, profile, args);
  RUNS.set(run.id, { ...run, status: "running" });
  appendScaffoldFinding(run.id, copyText);
  appendNote(run.id, "Chunk 1 scaffold only: CopyPass surface is live, but deterministic copy-quality checks land in a later chunk.");
  appendNote(run.id, "Use channel, audience, and goal fields now so later evaluator passes inherit realistic operator context.");

  const completed = RUNS.get(run.id);
  if (!completed) return { error: "run disappeared before completion" };
  completed.status = "complete";
  completed.completed_at = new Date().toISOString();
  RUNS.set(run.id, completed);

  return {
    run_id: completed.id,
    status: completed.status,
    finding_count: completed.findings.length,
    verdict_summary: completed.verdict_summary,
    notes: completed.notes,
    preview: completed.target.copy_text_preview,
  };
}

export async function copypassStatus(args: Record<string, unknown>): Promise<unknown> {
  const runId = typeof args.run_id === "string" ? args.run_id : "";
  if (!runId) return { error: "run_id is required" };
  const run = RUNS.get(runId);
  if (!run) return { error: `CopyPass run '${runId}' was not found in this MCP session` };
  return {
    run_id: run.id,
    status: run.status,
    profile: run.profile,
    finding_count: run.findings.length,
    verdict_summary: run.verdict_summary,
    target: run.target,
    notes: run.notes,
    completed_at: run.completed_at,
  };
}
