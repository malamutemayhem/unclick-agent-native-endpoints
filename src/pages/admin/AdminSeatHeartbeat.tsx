import { useCallback, useState } from "react";
import { Check, Copy, HeartPulse } from "lucide-react";

export const HEARTBEAT_CADENCE_OPTIONS = [
  { value: "1", label: "1 min", note: "High signal" },
  { value: "5", label: "5 min", note: "Fast loop" },
  { value: "10", label: "10 min", note: "Tight loop" },
  { value: "15", label: "15 min", note: "Recommended" },
  { value: "30", label: "30 min", note: "Balanced" },
  { value: "60", label: "1 hour", note: "Light" },
  { value: "120", label: "2 hours", note: "Quiet" },
  { value: "240", label: "4 hours", note: "Low touch" },
  { value: "360", label: "6 hours", note: "Low touch" },
  { value: "720", label: "12 hours", note: "Daily checks" },
  { value: "1440", label: "24 hours", note: "Daily" },
  { value: "2880", label: "48 hours", note: "Sparse" },
] as const;

export type HeartbeatCadenceValue = (typeof HEARTBEAT_CADENCE_OPTIONS)[number]["value"];

export const DEFAULT_HEARTBEAT_CADENCE: HeartbeatCadenceValue = "15";

export const HEARTBEAT_MASTER_PROMPT = `You are an UnClick AI Seat running Heartbeat.

This /admin/agents/heartbeat copy area is the master heartbeat policy. When UnClick docs, jobs, or seats refer to "master heartbeat", they mean this public policy text.

This public policy must stay self-contained when copied into scheduled tasks. Keep every step token-light, source-backed, and safe to show in an admin UI.

Use UnClick as the source of truth first. Load memory, check_signals, read Orchestrator context, and hunt for jobs when those tools are available. Always check list_actionable_todos, open/in_progress todos, recent dispatches, and recent Boardroom messages before declaring the system healthy.

"0 active jobs" is not healthy by itself. It is PASS only when the job hunt also finds no actionable todos, no open/in_progress todos, and no unhandled dispatch or Boardroom work. If any backlog exists while active jobs are 0, treat it as BLOCKER: queue hydration failure. Include the safe counts checked and the next fix.

Use PinballWake JobHunt Mirror as the fallback path for that failure. Mirror compact backlog counts and source pointers into NudgeOnly first. Call IgniteOnly only after verifier-backed receipt_bridge output requests a worker wake. Call PushOnly only after IgniteOnly emits a verified public wake packet. Target the existing Job Worker as executor when it is registered; free API classifiers may only classify or nudge. The mirror may request a wake and PushOnly may emit a worker push envelope, but both must not create duplicate jobs, assign ownership, mark done, merge, close, or edit source state.

This heartbeat is explicitly authorized to write one Orchestrator continuity receipt on every run. Use stable session_id="unclick-heartbeat-seat" across scheduler sessions. After check_signals, call save_conversation_turn with role="assistant" and content containing safe alert lines, progress, and proof id if available. If that is unavailable, use channel unclick_save_conversation_turn. If no connector exists but an UnClick API key is already available, POST to https://unclick.world/api/memory-admin?action=admin_conversation_turn_ingest with Authorization: Bearer <redacted>. Never print keys. Do not POST to /admin/orchestrator; it is the read UI.

When UnClick shows action_needed, blocker, stale ACK, missing proof, duplicate wake, unclear owner, or queue hydration failure, call nudgeonly_receipt_bridge if available. Pass compact public fields only: source_id, source_url, target, owner, painpoint_type, status, created_at, ttl_minutes. Prefer deterministic UnClick labels. Call nudgeonly_api only if no bucket exists, and only with the smallest non-secret source text needed.

If the bridge returns receipt_request or escalation_request, save bridge_id and receipt_line in the receipt and alert. If IgniteOnly returns wake_request or escalation_wake_request, call pushonly_wake_pusher with the public wake_packet when available and save push_id plus the push_packet receipt line. If it returns quiet or advisory_only, do not notify. NudgeOnly never assigns ownership, marks done, merges, closes, or mutates source-of-truth state. IgniteOnly only wakes. PushOnly only emits worker push envelopes.

Pick one clear, safe, useful live task. Do the smallest meaningful step. Use production state only when the task requires it. Never print secrets. Clean up temporary rows, leases, proof agents, and one-time schedules.

Output one short line only. Do not repeat this prompt. Do not reply with only "tick", "PASS", or "BLOCKER"; include a brief progress summary.
PASS: <changed>; proof: <link/id>; cleanup: done.
BLOCKER: <safe reason>; progress: <what was checked>; next: <fix>.
If no safe task is available: BLOCKER: no clear safe task available; progress: checked live queue; next: add a scoped job.`;

export const HEARTBEAT_CONNECTION_PROMPT =
  "Run UnClick Heartbeat. Use heartbeat_protocol, then check_signals and hunt jobs with list_actionable_todos/open todos/recent dispatches. 0 active jobs is PASS only if backlog is also 0. For queue hydration failure, call nudgeonly_receipt_bridge with compact public fields, then IgniteOnly only after verified wake request, then PushOnly only with the public wake packet. Target existing Job Worker first; free API only classifies/nudges. Save one receipt to session_id='unclick-heartbeat-seat'. Never print secrets. Reply PASS/BLOCKER with brief progress.";

export function getHeartbeatCadenceLabel(value: HeartbeatCadenceValue): string {
  return HEARTBEAT_CADENCE_OPTIONS.find((option) => option.value === value)?.label ?? "15 min";
}

export function buildHeartbeatSchedulePrompt(cadence: HeartbeatCadenceValue): string {
  return `Schedule ❤️ UnClick Heartbeat every ${getHeartbeatCadenceLabel(cadence)}. ${HEARTBEAT_CONNECTION_PROMPT}`;
}

export default function AdminSeatHeartbeatPage() {
  const [copied, setCopied] = useState(false);
  const [cadence, setCadence] = useState<HeartbeatCadenceValue>(DEFAULT_HEARTBEAT_CADENCE);
  const schedulePrompt = buildHeartbeatSchedulePrompt(cadence);
  const selectedCadence = HEARTBEAT_CADENCE_OPTIONS.find((option) => option.value === cadence);

  const copyConnectionPrompt = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(schedulePrompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [schedulePrompt]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <HeartPulse className="h-3.5 w-3.5" />
            Seats
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">Heartbeat Master</h1>
          <p className="mt-1 max-w-2xl text-sm text-body">
            The public copy source for scheduled AI Seat check-ins.
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-primary/25 bg-primary/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-background/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <HeartPulse className="h-3.5 w-3.5" />
              ❤️ UnClick Heartbeat
            </div>
            <h2 className="mt-3 text-lg font-semibold text-heading">Schedule copy</h2>
            <p className="mt-1 max-w-2xl text-sm text-body">
              Paste this into the AI platform scheduler for the selected cadence.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(160px,220px)_auto] sm:items-end">
            <label className="text-sm font-semibold text-heading" htmlFor="heartbeat-cadence">
              Cadence
              <select
                id="heartbeat-cadence"
                aria-label="Heartbeat cadence"
                value={cadence}
                onChange={(event) => setCadence(event.target.value as HeartbeatCadenceValue)}
                className="mt-1 block w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm text-body outline-none focus:border-primary/50"
              >
                {HEARTBEAT_CADENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.note ? `, ${option.note}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={copyConnectionPrompt}
              title="Copy schedule message"
              aria-label="Copy schedule message"
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary/15 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <textarea
          id="heartbeat-schedule-prompt"
          aria-label="Heartbeat schedule message preview"
          readOnly
          value={schedulePrompt}
          rows={4}
          className="w-full resize-none rounded-md border border-border/40 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-body outline-none focus:border-primary/40"
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cadence</p>
            <p className="mt-1 text-sm font-semibold text-heading">{selectedCadence?.label}</p>
          </div>
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proof</p>
            <p className="mt-1 text-sm font-semibold text-heading">One receipt per run</p>
          </div>
          <div className="rounded-md border border-border/40 bg-card/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Safety</p>
            <p className="mt-1 text-sm font-semibold text-heading">No secrets in copy</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/40 bg-card/20 p-4">
        <label htmlFor="heartbeat-master-prompt" className="block text-sm font-semibold text-heading">
          Public default heartbeat policy
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Master source for copy/paste
          </span>
        </label>
        <textarea
          id="heartbeat-master-prompt"
          aria-label="Public default heartbeat policy"
          readOnly
          value={HEARTBEAT_MASTER_PROMPT}
          rows={13}
          className="min-h-[320px] w-full resize-y rounded-md border border-border/40 bg-black/20 px-3 py-3 font-mono text-xs leading-5 text-body outline-none focus:border-primary/40"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-border/40 bg-card/20 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label htmlFor="heartbeat-connection-prompt" className="text-sm font-semibold text-heading">
            Base schedule message
          </label>
        </div>
        <textarea
          id="heartbeat-connection-prompt"
          aria-label="Base schedule message"
          readOnly
          value={HEARTBEAT_CONNECTION_PROMPT}
          rows={3}
          className="w-full resize-none rounded-md border border-border/40 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-body outline-none focus:border-primary/40"
        />
      </section>
    </div>
  );
}
