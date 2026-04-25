import { ShieldCheck } from "lucide-react";

export default function AdminModeration() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-[#E2B93B]" />
        <h1 className="text-2xl font-semibold text-white">Marketplace Moderation</h1>
        <span className="rounded-full border border-[#E2B93B]/40 bg-[#E2B93B]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#E2B93B]">
          Coming soon
        </span>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
        <p className="text-sm leading-relaxed text-[#ccc]">
          A review queue for tools submitted by outside developers. Approve what looks good,
          reject what does not, and keep the marketplace safe for everyone using it.
        </p>
      </div>
    </div>
  );
}
