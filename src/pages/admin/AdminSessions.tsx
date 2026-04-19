/**
 * AdminSessions - /admin/memory/sessions
 *
 * Past conversation summaries. Extracted from the "Sessions" tab
 * of the former AdminMemory page.
 */

import { useMemo } from "react";
import { Clock } from "lucide-react";
import SessionsTab from "./memory/SessionsTab";

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

export default function AdminSessions() {
  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);

  if (!apiKey) return <NoKeyMessage />;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
          <Clock className="h-5 w-5 text-[#61C1C4]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Sessions</h1>
          <p className="text-sm text-[#888]">Past conversations</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-[#888]">
        Summaries of past AI conversations. Your AI reads the last 5 at startup
        so it picks up where you left off.
      </p>
      <SessionsTab apiKey={apiKey} />
    </div>
  );
}
