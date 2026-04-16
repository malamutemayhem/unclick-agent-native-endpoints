import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain } from "lucide-react";
import StorageBar from "./memory/StorageBar";
import { InfoCard } from "./memory/InfoCard";
import ContextTab from "./memory/ContextTab";
import FactsTab from "./memory/FactsTab";
import SessionsTab from "./memory/SessionsTab";
import LibraryTab from "./memory/LibraryTab";
import MemoryActivityTab from "./memory/MemoryActivityTab";

const TABS = [
  { id: "context", label: "Context" },
  { id: "facts", label: "Facts" },
  { id: "sessions", label: "Sessions" },
  { id: "library", label: "Library" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminMemoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "context";

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

  const apiKey = useMemo(() => localStorage.getItem("unclick_api_key") ?? "", []);

  useEffect(() => {
    if (!apiKey) {
      setStorageLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_memory_activity", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const body = await res.json();
          setStorage(body.storage ?? null);
        }
      } finally {
        setStorageLoading(false);
      }
    })();
  }, [apiKey]);

  const setTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  if (!apiKey) {
    return (
      <p className="text-sm text-white/50">
        No API key found. Set your UnClick API key in Settings to access Memory Admin.
      </p>
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
            <h1 className="text-2xl font-semibold tracking-tight text-white">Memory Admin</h1>
            <p className="text-sm text-white/50">View and manage your agent's persistent memory</p>
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
        {activeTab === "context" && (
          <>
            <InfoCard
              id="context"
              title="What is Business Context?"
              description="These are your standing rules - things your agent should always know. Your name, role, key projects, how you like to work. They load FIRST at the start of every session."
              learnMore="Think of these as instructions pinned to the top of every conversation. Priority #1 loads first. Your agent reads all of these before it says a word. You can add, edit, reorder, or remove entries anytime."
            />
            <ContextTab apiKey={apiKey} />
          </>
        )}
        {activeTab === "facts" && (
          <>
            <InfoCard
              id="facts"
              title="What are Extracted Facts?"
              description="Atomic things your agent learned from conversations - preferences, decisions, project details. Each has a confidence score and freshness tier."
              learnMore="Facts are extracted automatically. 'Hot' facts load every session. 'Warm' are available but not auto-loaded. 'Cold' are archived but searchable. Frequently used facts stay hot; unused ones naturally cool down."
            />
            <FactsTab apiKey={apiKey} />
          </>
        )}
        {activeTab === "sessions" && (
          <>
            <InfoCard
              id="sessions"
              title="What are Session Summaries?"
              description="A recap of each conversation - what was discussed, decided, and what's still open. Your agent reads the last 5 at startup."
              learnMore="Written automatically at the end of significant conversations. They include decisions, open loops, and topic tags. This is how your agent picks up where you left off."
            />
            <SessionsTab apiKey={apiKey} />
          </>
        )}
        {activeTab === "library" && (
          <>
            <InfoCard
              id="library"
              title="What is the Knowledge Library?"
              description="Versioned reference documents - playbooks, templates, client briefs. Your agent looks them up by name anytime."
              learnMore="Unlike facts (small, atomic), library docs are full-length reference material. Version-controlled so you can see changes over time. Only titles load at session start; full docs are fetched on demand."
            />
            <LibraryTab apiKey={apiKey} />
          </>
        )}
        {activeTab === "activity" && (
          <>
            <InfoCard
              id="activity"
              title="What does this show?"
              description="How your agent uses memory - what's being stored, aging out, and accessed most."
              learnMore="The decay system keeps memory fresh. Frequently used items stay 'hot' and load every session. Unused items gradually cool to 'warm' then 'cold'. Your agent's context stays relevant, not cluttered."
            />
            <MemoryActivityTab apiKey={apiKey} />
          </>
        )}
    </>
  );
}
