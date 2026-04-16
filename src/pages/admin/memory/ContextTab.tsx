import { useEffect, useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Shield } from "lucide-react";
import EmptyState from "./EmptyState";

interface ContextEntry {
  id: string;
  category: string;
  key: string;
  value: unknown;
  priority: number;
  decay_tier: string;
}

/** Safely convert a JSONB value to a displayable string. */
function displayValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return JSON.stringify(v, null, 2);
}

const DECAY_COLORS: Record<string, string> = {
  hot: "bg-red-500",
  warm: "bg-amber-500",
  cold: "bg-blue-400",
};

export default function ContextTab({ apiKey }: { apiKey: string }) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", key: "", value: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memory-admin?action=admin_business_context&method=list", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = await res.json();
        setEntries(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.category || !form.key || !form.value) return;
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "create", ...form }),
    });
    setForm({ category: "", key: "", value: "" });
    setShowForm(false);
    load();
  };

  const handleUpdate = async () => {
    if (!editId || !form.value) return;
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "update", id: editId, category: form.category, value: form.value }),
    });
    setEditId(null);
    setForm({ category: "", key: "", value: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "delete", id }),
    });
    load();
  };

  const handleSwap = async (index: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= entries.length) return;
    const items = [
      { id: entries[index].id, priority: entries[swapIdx].priority },
      { id: entries[swapIdx].id, priority: entries[index].priority },
    ];
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ method: "reorder", items }),
    });
    load();
  };

  const startEdit = (e: ContextEntry) => {
    setEditId(e.id);
    setForm({ category: e.category, key: e.key, value: displayValue(e.value) });
    setShowForm(false);
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.06]" />)}</div>;
  }

  if (entries.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={Shield}
        heading="Your master context is empty"
        description="This is the first thing your agent reads every session. Add your name, role, key projects, and preferences here."
        steps={[
          "Add your name and role",
          "Add your key projects",
          "Add your preferences - how you like to work",
        ]}
        cta="Add your first context entry"
        onAction={() => setShowForm(true)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={entry.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
          {editId === entry.id ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Category"
                  className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
                />
                <input
                  value={form.key}
                  disabled
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white/50"
                />
              </div>
              <textarea
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                rows={3}
                placeholder="Value"
                className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={handleUpdate} className="rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">Save</button>
                <button onClick={() => { setEditId(null); setForm({ category: "", key: "", value: "" }); }} className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {/* Priority badge */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-xs font-bold text-amber-500">
                {entry.priority}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    {entry.category}
                  </span>
                  <span className="font-semibold text-sm text-white">{entry.key}</span>
                  <span className="flex items-center gap-1 text-[10px] text-white/30">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${DECAY_COLORS[entry.decay_tier] ?? "bg-gray-500"}`} />
                    {entry.decay_tier}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/60 line-clamp-2">{displayValue(entry.value)}</p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleSwap(i, "up")}
                  disabled={i === 0}
                  className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white disabled:opacity-20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleSwap(i, "down")}
                  disabled={i === entries.length - 1}
                  className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white disabled:opacity-20"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => startEdit(entry)} className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(entry.id)} className="rounded p-1 text-white/30 hover:bg-red-500/20 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {showForm ? (
        <div className="rounded-lg border border-[#61C1C4]/20 bg-white/[0.03] p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category (e.g. identity, preference, workflow)"
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
            />
            <input
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="Key (e.g. timezone, preferred_stack)"
              className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
            />
          </div>
          <textarea
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            rows={3}
            placeholder="Value"
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#61C1C4]/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">Add Entry</button>
            <button onClick={() => { setShowForm(false); setForm({ category: "", key: "", value: "" }); }} className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.1] py-3 text-xs text-white/40 transition-colors hover:border-[#61C1C4]/30 hover:text-[#61C1C4]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Context Entry
        </button>
      )}
    </div>
  );
}
