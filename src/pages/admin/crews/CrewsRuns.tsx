import CrewsNav from "@/components/crews/CrewsNav";
import { History } from "lucide-react";

export default function CrewsRuns() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Runs</h1>
      <p className="mb-6 text-sm text-[#777]">
        Every crew run you start will appear here with its status and result.
      </p>
      <CrewsNav />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-20 text-center">
        <History className="mb-3 h-8 w-8 text-[#444]" />
        <p className="text-sm font-medium text-[#777]">No crews have run yet.</p>
        <p className="mt-1 max-w-xs text-xs text-[#555]">
          Pick a starter crew on the Templates page, type your question, and press Go. Your run
          history will appear here.
        </p>
      </div>
    </div>
  );
}
