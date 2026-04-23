import { ScrollText } from "lucide-react";

export default function AdminAuditLog() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-[#E2B93B]" />
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <span className="rounded-full border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#E2B93B]">
          Coming soon
        </span>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <p className="text-sm leading-relaxed text-[#ccc]">
          A record of every admin action taken inside UnClick. Helps answer the question "who
          changed what and when" and keeps things transparent for GDPR and compliance reviews.
        </p>
      </div>
    </div>
  );
}
