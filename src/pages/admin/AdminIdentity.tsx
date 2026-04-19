/**
 * AdminIdentity - /admin/memory/identity
 *
 * Standing instructions that load at every session start. Extracted from
 * the "Identity" tab of the former AdminMemory page.
 */

import { useMemo } from "react";
import { Fingerprint } from "lucide-react";
import ContextTab from "./memory/ContextTab";

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

export default function AdminIdentity() {
  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);

  if (!apiKey) return <NoKeyMessage />;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E2B93B]/10">
          <Fingerprint className="h-5 w-5 text-[#E2B93B]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Identity</h1>
          <p className="text-sm text-[#888]">Who you are to your AI</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-[#888]">
        Permanent instructions your AI follows every session. Your brand,
        preferences, rules -- everything here loads at session start.
      </p>
      <div className="mb-4 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/[0.06] p-4">
        <p className="text-sm text-[#61C1C4]/90">
          Everything here loads at the start of every AI session.
          Think of it as your AI's permanent instructions.
        </p>
      </div>
      <ContextTab apiKey={apiKey} />
    </div>
  );
}
