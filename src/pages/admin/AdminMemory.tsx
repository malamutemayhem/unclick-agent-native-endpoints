import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain } from "lucide-react";
import { useSession } from "@/lib/auth";
import StorageBar from "./memory/StorageBar";
import ContextTab from "./memory/ContextTab";
import FactsTab from "./memory/FactsTab";
import SessionsTab from "./memory/SessionsTab";

const TABS = [
  { id: "facts", label: "Facts" },
  { id: "sessions", label: "Sessions" },
  { id: "identity", label: "Identity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Back-compat for existing deep links that used ?tab=context
function resolveTab(param: string | null): TabId {
  if (param === "context") return "identity";
  if (param === "facts" || param === "sessions" || param === "identity") return param;
  return "facts";
}

export default function AdminMemoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  const [storage, setStorage] = useState<{
    business_context: number;
    knowledge_library: number;
    session_summaries: number;
    extracted_facts: number;
    conversation_log: number;
    code_dumps: number;
    total: number;
  } | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  // Use the Supabase session access token as the Bearer for all
  // /api/memory-admin calls. The backend now resolves the tenant
  // api_key_hash server-side from the session user, so a stale
  // localStorage.unclick_api_key from a prior user cannot impersonate
  // the current signer. See issue #60.
  const { session, loading: sessionLoading } = useSession();
  const accessToken = session?.access_token ?? "";

  useEffect(() => {
    if (!accessToken) {
      setStorageLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_memory_activity", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const body = await res.json();
          setStorage(body.storage ?? null);
        }
      } finally {
        setStorageLoading(false);
      }
    })();
  }, [accessToken]);

  const setTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  if (sessionLoading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/70">Loading your session...</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/70">Sign in to see what UnClick remembers about you.</p>
        <p className="mt-2 text-xs text-white/50">
          Memory is scoped to your account; sign in from <a href="/login" className="text-[#61C1C4] underline">/login</a> to continue.
        </p>
      </div>
    );
  }

  return (
    <>
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10">
            <Brain className="h-5 w-5 text-[#61C1C4]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Memory</h1>
            <p className="text-sm text-white/50">Everything UnClick remembers about you</p>
          </div>
        </div>

        {/* Storage bar */}
        <StorageBar storage={storage} loading={storageLoading} />

        {/* Tab bar */}
        <div className="mb-6 flex gap-0 border-b border-white/[0.06]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#61C1C4]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#61C1C4] rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "facts" && (
          <div>
            <p className="mb-4 text-sm text-white/60">
              What UnClick remembers about you. Preferences, decisions, contacts, technical details.
              These appear here automatically as you use UnClick. You can also add them manually.
            </p>
            <FactsTab apiKey={accessToken} />
          </div>
        )}
        {activeTab === "sessions" && (
          <div>
            <p className="mb-4 text-sm text-white/60">
              What happened in past conversations. Summaries, decisions made, open loops.
              New sessions read the most recent ones so your agent picks up where you left off.
            </p>
            <SessionsTab apiKey={accessToken} />
          </div>
        )}
        {activeTab === "identity" && (
          <div>
            <div className="mb-4 rounded-lg border border-[#61C1C4]/30 bg-[#61C1C4]/[0.06] p-4">
              <p className="text-sm text-[#61C1C4]/90">
                Everything here loads at the start of every AI session.
                Think of it as your AI's permanent instructions.
              </p>
            </div>
            <ContextTab apiKey={accessToken} />
          </div>
        )}
    </>
  );
}
