import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Trash2, Lightbulb, Plus, Pencil, Check, X, Loader2 } from "lucide-react";
import EmptyState from "./EmptyState";

interface Fact {
  id: string;
  fact: string;
  category: string;
  status: string;
  decay_tier: string;
  confidence: number;
  access_count: number;
  created_at: string;
}

type SortMode = "newest" | "oldest" | "category";

const DEFAULT_CATEGORIES = [
  "general",
  "preference",
  "decision",
  "contact",
  "technical",
  "workflow",
];

function confidenceTone(conf: number): { color: string; label: string } {
  if (conf >= 0.8) return { color: "bg-green-500", label: "High" };
  if (conf >= 0.5) return { color: "bg-[#E2B93B]", label: "Medium" };
  return { color: "bg-red-500", label: "Low" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FactsTab({ apiKey }: { apiKey: string }) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFact, setAddFact] = useState("");
  const [addCategory, setAddCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [editDraft, setEditDraft] = useState<{ id: string; fact: string; category: string } | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory-admin?action=facts&show_all=true`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setFacts(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const f of facts) set.add(f.category || "general");
    return Array.from(set).sort();
  }, [facts]);

  const activeFacts = useMemo(() => facts.filter((f) => f.status === "active"), [facts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = activeFacts;
    if (q) {
      list = list.filter(
        (f) =>
          f.fact.toLowerCase().includes(q) || (f.category ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sortMode === "newest") {
      sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    } else {
      sorted.sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""));
    }
    return sorted;
  }, [activeFacts, query, sortMode]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteFact(id: string) {
    await fetch("/api/memory-admin?action=delete_fact", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fact_id: id }),
    });
    setFacts((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        fetch("/api/memory-admin?action=delete_fact", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fact_id: id }),
        })
      )
    );
    setFacts((prev) => prev.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  }

  async function handleAdd() {
    const text = addFact.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/memory-admin?action=admin_fact_add", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fact: text, category: addCategory }),
      });
      if (res.ok) {
        await load();
        setAddFact("");
        setAddCategory(DEFAULT_CATEGORIES[0]);
        setShowAddForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editDraft) return;
    const text = editDraft.fact.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/memory-admin?action=admin_update_fact", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fact_id: editDraft.id,
          fact: text,
          category: editDraft.category || "general",
        }),
      });
      if (res.ok) {
        setFacts((prev) =>
          prev.map((f) =>
            f.id === editDraft.id
              ? { ...f, fact: text, category: editDraft.category || "general" }
              : f
          )
        );
        setEditDraft(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.03]"
          />
        ))}
      </div>
    );
  }

  const isEmpty = activeFacts.length === 0 && !showAddForm;

  return (
    <div className="space-y-4">
      {/* Top bar: search, sort, add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search facts..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-[#61C1C4]/50 focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="category">By category</option>
        </select>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#61C1C4] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add fact
        </button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs">
          <span className="text-white/70">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2 py-1 text-white/60 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-500/80 px-2 py-1 font-semibold text-white hover:bg-red-500"
            >
              <Trash2 className="h-3 w-3" /> Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="space-y-3 rounded-lg border border-[#61C1C4]/20 bg-white/[0.03] p-4">
          <textarea
            value={addFact}
            onChange={(e) => setAddFact(e.target.value)}
            rows={3}
            placeholder="Type a fact. Example: I prefer dark mode in all my tools."
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-white/50">Category</label>
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-xs text-white focus:border-[#61C1C4]/50 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddFact("");
                }}
                className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting || !addFact.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Lightbulb}
          heading="No facts stored yet"
          description="As you use UnClick with Claude Code or other AI tools, facts will be saved automatically. You can also add them manually."
          cta="Add your first fact"
          onAction={() => setShowAddForm(true)}
        />
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-white/40">
          No facts match your search.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const tone = confidenceTone(f.confidence ?? 0);
            const isEditing = editDraft?.id === f.id;
            const isExpanded = expandedId === f.id;
            return (
              <div
                key={f.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggleSelect(f.id)}
                    className="mt-1 shrink-0 rounded border-white/20 bg-white/[0.03]"
                    aria-label="Select fact"
                  />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft!.fact}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft!, fact: e.target.value })
                          }
                          rows={2}
                          className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-sm text-white focus:border-[#61C1C4]/50 focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editDraft!.category}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft!, category: e.target.value })
                            }
                            className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs text-white focus:border-[#61C1C4]/50 focus:outline-none"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditDraft(null)}
                              className="rounded p-1 text-white/40 hover:text-white"
                              aria-label="Cancel edit"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={submitting || !editDraft!.fact.trim()}
                              className="rounded p-1 text-[#61C1C4] hover:text-white disabled:opacity-50"
                              aria-label="Save edit"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : f.id)}
                          className="block w-full text-left"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
                              {f.category}
                            </span>
                            <span
                              className="flex items-center gap-1 text-[10px] text-white/50"
                              title={`Confidence: ${tone.label}`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.color}`} />
                              {tone.label}
                            </span>
                            <span className="text-[10px] text-white/30">
                              {formatDate(f.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-white/80">{f.fact}</p>
                        </button>
                        {isExpanded && (
                          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-white/[0.04] pt-3 text-[11px] text-white/40">
                            <span>Confidence: {Math.round((f.confidence ?? 0) * 100)}%</span>
                            <span>Decay: {f.decay_tier}</span>
                            <span>Accessed: {f.access_count}x</span>
                            <div className="ml-auto flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft({ id: f.id, fact: f.fact, category: f.category })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-xs text-white/70 hover:text-white"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFact(f.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
