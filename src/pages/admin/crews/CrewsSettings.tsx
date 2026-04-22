import CrewsNav from "@/components/crews/CrewsNav";
import { Settings } from "lucide-react";

export default function CrewsSettings() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Crew Settings</h1>
      <p className="mb-6 text-sm text-[#777]">
        Global defaults for how your crews run.
      </p>
      <CrewsNav />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-20 text-center">
        <Settings className="mb-3 h-8 w-8 text-[#444]" />
        <p className="text-sm font-medium text-[#777]">Nothing to configure yet.</p>
        <p className="mt-1 max-w-xs text-xs text-[#555]">
          This is where the default chairman model, token caps, and crew sharing settings will
          live. Coming in Phase B.
        </p>
      </div>
    </div>
  );
}
