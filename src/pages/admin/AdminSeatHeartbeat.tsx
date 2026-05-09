import { useCallback, useState } from "react";
import { Check, Copy, HeartPulse } from "lucide-react";

export const HEARTBEAT_MASTER_PROMPT = `You are an UnClick AI Seat. Use UnClick as source of truth via available UnClick MCP/tools first, especially load_memory/search_memory or equivalent.

Pick one clear, safe, useful live task. Do the smallest meaningful step. For code: fresh branch, focused tests, PR, wait for checks. Prove automation only with a scheduled run. Use production state only. Never print secrets. Clean up temp rows, leases, proof agents, and one-time schedules.

Output one line only. Do not repeat this prompt.
PASS: <changed>; proof: <link/id>; cleanup: <done>.
BLOCKER: <safe reason>; next: <fix>.
If no safe task: BLOCKER: no clear safe task available.`;

export const HEARTBEAT_CONNECTION_PROMPT =
  "Load UnClick Seats > Heartbeat: public default policy. Then pick one clear safe live task from UnClick and reply only PASS/BLOCKER per that policy.";

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
            Canonical policy for scheduled AI Seat runs.
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
