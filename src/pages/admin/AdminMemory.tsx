/**
 * AdminMemory - Memory surface (/admin/memory)
 *
 * 6-layer view of the user's memory. Shows mc_extracted_facts for the
 * authenticated user's api_key_hash with search/filter. Edit and
 * delete individual facts. Storage usage vs free-tier caps.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import {
  Brain,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Database,
  AlertTriangle,
} from "lucide-react";

interface Fact {
  id: string;
  fact: string;
  category: string;
  confidence: number;
  status: string;
  decay_tier: string;
  source_type: string;
  created_at: string;
  updated_at: string;
}

interface StorageInfo {
  storage_bytes: number;
  fact_count: number;
  tier: string;
  caps: { storage_bytes: number; facts: number };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminMemory() {
  const { session } = useSession();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const fetchData = useCallback(async () => {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    const params = new URLSearchParams({ action: "admin_facts" });
    if (query) params.set("query", query);
    if (showAll) params.set("show_all", "true");

    const [factsRes, storageRes] = await Promise.all([
      fetch(`/api/memory-admin?${params}`, { headers }),
      fetch("/api/memory-admin?action=admin_storage", { headers }),
    ]);

    if (factsRes.ok) {
      const body = await factsRes.json();
      setFacts(body.data ?? []);
    }
    if (storageRes.ok) {
      setStorage(await storageRes.json());
    }
    setLoading(false);
  }, [session, query, showAll]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function deleteFact(factId: string) {
    if (!session) return;
    await fetch("/api/memory-admin?action=admin_delete_fact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fact_id: factId }),
    });
    setFacts((prev) => prev.filter((f) => f.id !== factId));
  }

  async function saveFact(factId: string) {
    if (!session || !editText.trim()) return;
    const res = await fetch("/api/memory-admin?action=admin_update_fact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fact_id: factId, fact: editText.trim() }),
    });
    if (res.ok) {
      setFacts((prev) =>
        prev.map((f) => (f.id === factId ? { ...f, fact: editText.trim() } : f)),
      );
      setEditingId(null);
    }
  }

  const storagePercent = storage
    ? Math.min((storage.storage_bytes / storage.caps.storage_bytes) * 100, 100)
    : 0;
  const factsPercent = storage
    ? Math.min((storage.fact_count / storage.caps.facts) * 100, 100)
    : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Memory</h1>
        <p className="mt-1 text-sm text-[#888]">
          Your agent's extracted facts and memory usage
        </p>
      </div>

      {/* Storage usage cards */}
      {storage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium text-[#888]">
                <Database className="h-3.5 w-3.5" />
                Storage
              </span>
              <span className="text-xs text-[#666]">
                {formatBytes(storage.storage_bytes)} / {formatBytes(storage.caps.storage_bytes)}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all ${
                  storagePercent > 90 ? "bg-red-400" : "bg-[#E2B93B]"
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            {storagePercent > 80 && (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {storagePercent > 90 ? "Storage almost full" : "Approaching storage limit"}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium text-[#888]">
                <Brain className="h-3.5 w-3.5" />
                Facts
              </span>
              <span className="text-xs text-[#666]">
                {storage.fact_count.toLocaleString()} / {storage.caps.facts.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all ${
                  factsPercent > 90 ? "bg-red-400" : "bg-[#E2B93B]"
                }`}
                style={{ width: `${factsPercent}%` }}
              />
            </div>
            {factsPercent > 80 && (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {factsPercent > 90 ? "Fact limit almost reached" : "Approaching fact limit"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            placeholder="Search facts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-[#111111] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#555] outline-none transition-colors focus:border-[#E2B93B]/30"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#888]">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/[0.1] bg-[#111111] accent-[#E2B93B]"
          />
          Show archived
        </label>
      </div>

      {/* Facts list */}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading facts...</span>
        </div>
      ) : facts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-8 text-center">
          <Brain className="mx-auto h-8 w-8 text-[#333]" />
          <p className="mt-3 text-sm text-[#666]">
            {query ? "No facts match your search" : "No facts extracted yet"}
          </p>
          <p className="mt-1 text-xs text-[#444]">
            Facts appear here as your agent learns from conversations
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => (
            <div
              key={fact.id}
              className={`group rounded-xl border bg-[#111111] p-4 transition-colors ${
                fact.status !== "active"
                  ? "border-white/[0.03] opacity-60"
                  : "border-white/[0.06]"
              }`}
            >
              {editingId === fact.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[#E2B93B]/30 bg-[#0A0A0A] p-3 text-sm text-white outline-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveFact(fact.id)}
                      className="flex items-center gap-1.5 rounded-md bg-[#E2B93B] px-3 py-1.5 text-xs font-medium text-black"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-[#888]"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{fact.fact}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#888]">
                        {fact.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          fact.decay_tier === "hot"
                            ? "bg-red-500/10 text-red-400"
                            : fact.decay_tier === "warm"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {fact.decay_tier}
                      </span>
                      {fact.status !== "active" && (
                        <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#666]">
                          {fact.status}
                        </span>
                      )}
                      <span className="text-[10px] text-[#555]">
                        {timeAgo(fact.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setEditingId(fact.id);
                        setEditText(fact.fact);
                      }}
                      className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-white/[0.04] hover:text-[#ccc]"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteFact(fact.id)}
                      className="rounded-md p-1.5 text-[#666] transition-colors hover:bg-red-500/10 hover:text-red-400"
                      title="Archive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
