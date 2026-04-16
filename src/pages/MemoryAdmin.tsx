/**
 * Memory Admin - 5-tab structured admin dashboard
 *
 * Tabs: Context | Facts | Sessions | Library | Activity
 * Route: /memory/admin
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Brain, ListOrdered, Lightbulb, MessageSquare, BookOpen, Activity } from "lucide-react";
import StorageBar from "./admin/memory/StorageBar";
import ContextTab from "./admin/memory/ContextTab";
import FactsTab from "./admin/memory/FactsTab";
import SessionsTab from "./admin/memory/SessionsTab";
import LibraryTab from "./admin/memory/LibraryTab";
import MemoryActivityTab from "./admin/memory/MemoryActivityTab";

interface StatusData {
  layers: {
    business_context: number;
    knowledge_library: number;
    session_summaries: number;
    extracted_facts: number;
    conversation_log: number;
    code_dumps: number;
  };
}

const TABS = [
  { id: "context", label: "Context", icon: ListOrdered },
  { id: "facts", label: "Facts", icon: Lightbulb },
  { id: "sessions", label: "Sessions", icon: MessageSquare },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MemoryAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "context";
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = localStorage.getItem("unclick_api_key") ?? "";

  const setTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=status", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          setStatus(await res.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-8 text-center">
            <p className="text-sm text-[#AAAAAA]">
              Set your API key in{" "}
              <a href="/settings" className="text-[#61C1C4] underline cursor-pointer transition-colors duration-150 hover:text-[#61C1C4]/80">
                Settings
              </a>{" "}
              to access memory admin.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-32 pt-28">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#61C1C4]/10 text-[#61C1C4]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-white">Memory</h1>
            <p className="text-sm text-[#AAAAAA]">View and manage your agent's persistent memory</p>
          </div>
        </div>

        {/* Storage bar */}
        {!loading && status && (
          <div className="mb-6">
            <StorageBar
              totalFacts={status.layers.extracted_facts}
              maxFacts={1000}
              storageLabel="Supabase"
            />
          </div>
        )}

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 border-b border-white/[0.06] overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`cursor-pointer flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "border-[#61C1C4] text-[#61C1C4]"
                    : "border-transparent text-[#666666] hover:text-[#AAAAAA]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "context" && <ContextTab apiKey={apiKey} />}
          {activeTab === "facts" && <FactsTab apiKey={apiKey} />}
          {activeTab === "sessions" && <SessionsTab apiKey={apiKey} />}
          {activeTab === "library" && <LibraryTab apiKey={apiKey} />}
          {activeTab === "activity" && <MemoryActivityTab apiKey={apiKey} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
