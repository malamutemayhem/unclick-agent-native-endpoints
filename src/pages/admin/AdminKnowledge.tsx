/**
 * AdminKnowledge - /admin/memory/knowledge
 *
 * Shows the user's stored facts. Extracted from the "Facts" tab
 * of the former AdminMemory page.
 */

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import FactsTab from "./memory/FactsTab";

function NoKeyMessage() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
      <p className="text-sm text-white/70">No API key found for this session.</p>
      <p className="mt-2 text-xs text-white/50">
        Sign in or grab a free key from the homepage, then come back to see what UnClick
        remembers about you.
      </p>
    </div>
  );
}

export default function AdminKnowledge() {
  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);

  if (!apiKey) return <NoKeyMessage />;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f472b6]/10">
          <Lightbulb className="h-5 w-5 text-[#f472b6]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Knowledge</h1>
          <p className="text-sm text-[#888]">What your AI knows</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-[#888]">
        Things your AI remembers. Preferences, decisions, technical details.
        Added automatically from conversations or manually by you.
      </p>
      <FactsTab apiKey={apiKey} />
    </div>
  );
}
