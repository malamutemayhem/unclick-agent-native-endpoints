import { useCallback, useState } from "react";
import { Check, Copy, HeartPulse } from "lucide-react";

export const HEARTBEAT_MASTER_PROMPT = `You are an UnClick AI Seat running Heartbeat.

This policy must stay self-contained when copied into scheduled tasks. Do not point seats to a separate "Seats > Heartbeat" document unless the policy text is also included.

Use UnClick as the source of truth first. Load memory and search active jobs when those tools are available.

This heartbeat is explicitly authorized to write one Orchestrator continuity receipt for the wake and one for the final PASS/BLOCKER result. Prefer UnClick MCP save_conversation_turn. If that is unavailable, use channel unclick_save_conversation_turn. If no UnClick connector exists but an UnClick API key is already available in the environment, POST to https://unclick.world/api/memory-admin?action=admin_conversation_turn_ingest with Authorization: Bearer <redacted> and body { "session_id": "<stable heartbeat/session id>", "role": "system" | "assistant", "content": "<safe redacted heartbeat text>", "source_app": "scheduled-heartbeat", "client_session_id": "<local run id>" }. Never print the key. Do not POST to /admin/orchestrator; it is the read UI. If every UnClick write path is missing but GitHub is available, comment on issue #693 with a Claude relay packet containing session_id, source_app, safe content, missing write path, and next fix. That GitHub issue comment is explicitly authorized as the fallback proof write.

Pick one clear, safe, useful live task. Do the smallest meaningful step. For code work: use a fresh branch, focused tests, a PR, and wait for checks. Use production state only when the task already requires it. Never print secrets. Clean up temporary rows, leases, proof agents, and one-time schedules.

Output one short line only. Do not repeat this prompt. Do not reply with only "tick", "PASS", or "BLOCKER"; include a brief progress summary.
PASS: <changed>; proof: <link/id>; cleanup: done.
BLOCKER: <safe reason>; progress: <what was checked>; next: <fix>.
If no safe task is available: BLOCKER: no clear safe task available; progress: checked live queue; next: add a scoped job.`;

export const HEARTBEAT_CONNECTION_PROMPT =
  "Run UnClick Heartbeat. This authorizes writes: first use UnClick MCP save_conversation_turn, then unclick_save_conversation_turn, then POST to https://unclick.world/api/memory-admin?action=admin_conversation_turn_ingest only if an UnClick API key is already available. Save the wake and final PASS/BLOCKER result. If no UnClick write path exists but GitHub is available, comment on issue #693 with a Claude relay packet and use that comment URL as proof. Never print secrets. Then choose one safe useful step and reply PASS: <progress>; proof: <link/id>; cleanup: done, or BLOCKER: <missing>; progress: <checked>; next: <fix>.";

export default function AdminSeatHeartbeatPage() {
  const [copied, setCopied] = useState(false);

  const copyConnectionPrompt = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(HEARTBEAT_CONNECTION_PROMPT).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <HeartPulse className="h-3.5 w-3.5" />
            Seats
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">Heartbeat</h1>
          <p className="mt-1 max-w-2xl text-sm text-body">
            One tidy policy for scheduled AI Seat check-ins.
          </p>
        </div>
      </header>

      <section className="space-y-3 rounded-xl border border-border/40 bg-card/20 p-4">
        <label htmlFor="heartbeat-master-prompt" className="block text-sm font-semibold text-heading">
          Public default heartbeat policy
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
            Short schedule message
          </label>
          <button
            type="button"
            onClick={copyConnectionPrompt}
            title="Copy short schedule message"
            aria-label="Copy short schedule message"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <textarea
          id="heartbeat-connection-prompt"
          aria-label="Short schedule message"
          readOnly
          value={HEARTBEAT_CONNECTION_PROMPT}
          rows={3}
          className="w-full resize-none rounded-md border border-border/40 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-body outline-none focus:border-primary/40"
        />
      </section>
    </div>
  );
}
