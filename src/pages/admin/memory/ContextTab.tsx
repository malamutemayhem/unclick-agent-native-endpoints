import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  ListOrdered,
} from "lucide-react";
import EmptyState from "./EmptyState";

interface ContextEntry {
  id: string;
  category: string;
  key: string;
  value: string;
  priority: number;
  decay_tier: string;
}

interface ContextTabProps {
  apiKey: string;
}

const DECAY_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-400", label: "Hot" },
  warm: { dot: "bg-[#E2B93B]", text: "text-[#E2B93B]", label: "Warm" },
  cold: { dot: "bg-blue-400", text: "text-blue-400", label: "Cold" },
};

export default function ContextTab({ apiKey }: ContextTabProps) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", key: "", value: "" });

  const fetchEntries = async () => {
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
  };

  useEffect(() => {
    fetchEntries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!form.category || !form.key || !form.value) return;
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method: "create", ...form }),
    });
    setForm({ category: "", key: "", value: "" });
    setShowForm(false);
    fetchEntries();
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method: "update", id: editingId, ...form }),
    });
    setEditingId(null);
    setForm({ category: "", key: "", value: "" });
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method: "delete", id }),
    });
    fetchEntries();
  };

  const handleSwap = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= entries.length) return;
    const items = [
      { id: entries[index].id, priority: entries[targetIndex].priority },
      { id: entries[targetIndex].id, priority: entries[index].priority },
    ];
    await fetch("/api/memory-admin?action=admin_business_context", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method: "reorder", items }),
    });
    fetchEntries();
  };

  const startEdit = (entry: ContextEntry) => {
    setEditingId(entry.id);
    setForm({ category: entry.category, key: entry.key, value: entry.value });
    setShowForm(false);
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[#666666]">Loading context...</p>;
  }

  if (entries.length === 0 && !showForm) {
    return (
      <div>
        <EmptyState
          icon={<ListOrdered className="h-6 w-6" />}
          heading="Your master context is empty"
          description="This is the first thing your agent reads every session. Add your name, role, key projects, and preferences here."
          cta={
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#61C1C4] px-4 py-2 text-sm font-semibold text-[#0A0A0A] transition-opacity duration-150 hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add your first context entry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-150 hover:border-white/[0.1]"
        >
          {/* Priority number */}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E2B93B]/10 font-mono text-xs font-bold text-[#E2B93B]">
            {i + 1}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {editingId === entry.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Category"
                  className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
                />
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="Key"
                  className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
                />
                <textarea
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="Value"
                  rows={3}
                  className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] transition-opacity duration-150 hover:opacity-90"
                  >
                    <Save className="h-3 w-3" /> Save
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setForm({ category: "", key: "", value: "" }); }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.1] px-3 py-1.5 text-xs text-[#AAAAAA] transition-colors duration-150 hover:text-white"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#AAAAAA]">
                    {entry.category}
                  </span>
                  <span className="text-sm font-semibold text-white">{entry.key}</span>
                  {DECAY_COLORS[entry.decay_tier] && (
                    <span className={`flex items-center gap-1 text-[10px] ${DECAY_COLORS[entry.decay_tier].text}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DECAY_COLORS[entry.decay_tier].dot}`} />
                      {DECAY_COLORS[entry.decay_tier].label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#AAAAAA]">{entry.value}</p>
              </>
            )}
          </div>

          {/* Actions */}
          {editingId !== entry.id && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => handleSwap(i, "up")}
                disabled={i === 0}
                className="cursor-pointer rounded p-1 text-[#666666] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSwap(i, "down")}
                disabled={i === entries.length - 1}
                className="cursor-pointer rounded p-1 text-[#666666] transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => startEdit(entry)}
                className="cursor-pointer rounded p-1 text-[#666666] transition-colors duration-150 hover:text-[#61C1C4]"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="cursor-pointer rounded p-1 text-[#666666] transition-colors duration-150 hover:text-red-400"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {showForm ? (
        <div className="rounded-lg border border-[#61C1C4]/30 bg-white/[0.03] p-4 space-y-2">
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category (e.g. identity, preference, workflow)"
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
          />
          <input
            type="text"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder="Key (e.g. timezone, preferred_stack)"
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
          />
          <textarea
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="Value"
            rows={3}
            className="w-full rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-[#666666] outline-none focus:border-[#61C1C4] transition-colors duration-150"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#61C1C4] px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] transition-opacity duration-150 hover:opacity-90"
            >
              <Save className="h-3 w-3" /> Save
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ category: "", key: "", value: "" }); }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.1] px-3 py-1.5 text-xs text-[#AAAAAA] transition-colors duration-150 hover:text-white"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.1] py-3 text-sm text-[#AAAAAA] transition-colors duration-150 hover:border-[#61C1C4]/40 hover:text-[#61C1C4]"
        >
          <Plus className="h-4 w-4" />
          Add Context Entry
        </button>
      )}
    </div>
  );
}
