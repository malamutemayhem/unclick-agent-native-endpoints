import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain } from "lucide-react";
import { useSession } from "@/lib/auth";
import StorageBar from "./memory/StorageBar";
import BrainMap from "./BrainMap";
import ContextTab from "./memory/ContextTab";
import FactsTab from "./memory/FactsTab";
import SessionsTab from "./memory/SessionsTab";
import LibraryTab from "./memory/LibraryTab";
import MemoryActivityTab from "./memory/MemoryActivityTab";

const TABS = [
  { id: "brain-map", label: "Brain Map" },
  { id: "facts",     label: "Facts"     },
  { id: "sessions",  label: "Sessions"  },
  { id: "library",   label: "Library"   },
  { id: "activity",  label: "Activity"  },
  { id: "identity",  label: "Identity"  },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Back-compat for existing deep links that used ?tab=context
function resolveTab(param: string | null): TabId {
  if (param === "context") return "identity";
  const valid: TabId[] = ["brain-map", "facts", "sessions", "library", "activity", "identity"];
  if (valid.includes(param as TabId)) return param as TabId;
  return "brain-map";
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

  // Admin gate: only admin emails (ADMIN_EMAILS env on the backend) can
  // load the memory surface. Everyone else sees a friendly "admin-only"
  // card instead of firing memory fetches that would 401 in the console.
  // `null` = not yet determined (still loading the admin_profile call).
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setStorageLoading(false);
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Resolve the admin flag FIRST. admin_profile is also the
      // endpoint that auto-provisions an api_keys row if one is missing
      // (see #63), so by the time we fire admin_memory_activity below
      // the tenant hash exists.
      let admin = false;
      try {
        const profileRes = await fetch("/api/memory-admin?action=admin_profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as { is_admin?: boolean };
          admin = Boolean(profile.is_admin);
        }
      } catch {
        admin = false;
      }
      if (cancelled) return;
      setIsAdmin(admin);

      if (!admin) {
        setStorageLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/memory-admin?action=admin_memory_activity", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const body = await res.json();
          if (!cancelled) setStorage(body.storage ?? null);
        }
      } finally {
        if (!cancelled) setStorageLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  // Still resolving the admin flag. Brief spinner instead of a flash
  // of admin-only content before the gate settles.
  if (isAdmin === null) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/70">Loading your memory workspace...</p>
      </div>
    );
  }

  // Non-admin: no memory fetches fire, no 401 console noise, friendly
  // message on the page.
  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/70">Memory is not available on this account yet.</p>
        <p className="mt-2 text-xs text-white/50">
          Your account settings and API key are on <a href="/admin/you" className="text-[#61C1C4] underline">/admin/you</a>.
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
        {activeTab === "brain-map" && <BrainMap />}
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
        {activeTab === "library" && (
          <div>
            <p className="mb-4 text-sm text-white/60">
              Knowledge documents stored by your agent. Reference material, guides, and notes
              that get loaded on demand via search.
            </p>
            <LibraryTab apiKey={accessToken} />
          </div>
        )}
        {activeTab === "activity" && (
          <div>
            <p className="mb-4 text-sm text-white/60">
              Memory activity over time. Fact growth, storage breakdown, decay signals,
              and most-accessed items.
            </p>
            <MemoryActivityTab apiKey={accessToken} />
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
