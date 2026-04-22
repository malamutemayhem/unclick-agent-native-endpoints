import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CrewsNav from "@/components/crews/CrewsNav";
import AgentPickerTile from "@/components/crews/AgentPickerTile";
import { MOCK_AGENTS, AGENT_CATEGORIES } from "@/data/mockAgents";
import { CREW_TEMPLATES } from "@/data/mockCrewTemplates";
import type { MockAgent } from "@/types/crews";
import { Search, Save, Users } from "lucide-react";

const MAX_HATS = 9;
const MIN_HATS = 3;

export default function CrewComposer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTemplate = searchParams.get("template") ?? CREW_TEMPLATES[0].slug;

  const [templateSlug, setTemplateSlug] = useState(initialTemplate);
  const [selected, setSelected] = useState<MockAgent[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [crewName, setCrewName] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return MOCK_AGENTS.filter((a) => {
      const matchCat = categoryFilter === "all" || a.category === categoryFilter;
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.hook.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [categoryFilter, query]);

  const selectedSlugs = useMemo(() => new Set(selected.map((a) => a.slug)), [selected]);

  function addAgent(agent: MockAgent) {
    if (selected.length >= MAX_HATS || selectedSlugs.has(agent.slug)) return;
    setSelected((prev) => [...prev, agent]);
  }

  function removeAgent(agent: MockAgent) {
    setSelected((prev) => prev.filter((a) => a.slug !== agent.slug));
  }

  function handleSave() {
    if (selected.length < MIN_HATS) return;
    navigate("/admin/crews");
  }

  const canSave = selected.length >= MIN_HATS && selected.length <= MAX_HATS;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Compose a Crew</h1>
      <p className="mb-6 text-sm text-[#777]">
        Pick 3 to 9 hats and a template, then save.
      </p>
      <CrewsNav />

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#aaa]">Crew name</span>
          <input
            type="text"
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
            placeholder="e.g. Launch Review Council"
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-[#eee] placeholder-[#444] focus:border-[#61C1C4]/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#aaa]">Template</span>
          <select
            value={templateSlug}
            onChange={(e) => setTemplateSlug(e.target.value)}
            className="w-full rounded-lg border border-white/[0.07] bg-[#0e0e0e] px-3 py-2 text-sm text-[#eee] focus:border-[#61C1C4]/40 focus:outline-none"
          >
            {CREW_TEMPLATES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}: {t.hook}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="mb-3 text-xs text-[#666]">
            Pick your team. Each hat is one AI agent with one specialty. Mix roles like CEO, CFO,
            and Designer with thinking styles like Contrarian or First Principles for a richer
            conversation.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                categoryFilter === "all"
                  ? "bg-[#61C1C4]/20 text-[#61C1C4]"
                  : "bg-white/[0.04] text-[#666] hover:text-[#aaa]"
              }`}
            >
              All
            </button>
            {AGENT_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  categoryFilter === cat.key
                    ? "bg-[#61C1C4]/20 text-[#61C1C4]"
                    : "bg-white/[0.04] text-[#666] hover:text-[#aaa]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#555]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hats by name or hook..."
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-[#eee] placeholder-[#444] focus:border-[#61C1C4]/40 focus:outline-none"
            />
          </div>
          <div className="grid max-h-[52vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
            {filtered.map((agent) => (
              <AgentPickerTile
                key={agent.slug}
                agent={agent}
                mode="pick"
                onAdd={addAgent}
                disabled={selectedSlugs.has(agent.slug) || selected.length >= MAX_HATS}
              />
            ))}
            {filtered.length === 0 && (
              <p className="col-span-2 py-6 text-center text-xs text-[#555]">
                No hats match your search. Try a different keyword or category.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#61C1C4]" />
              <span className="text-xs font-semibold text-[#ccc]">
                Your crew ({selected.length}/{MAX_HATS})
              </span>
            </div>
            {selected.length < MIN_HATS && (
              <span className="text-[10px] text-[#555]">
                Add {MIN_HATS - selected.length} more
              </span>
            )}
          </div>

          {selected.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] py-10 text-center">
              <p className="text-xs text-[#555]">
                Add 3 to 9 hats from the left column. Try mixing thinking styles with role experts
                for best results.
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {selected.map((agent) => (
                <AgentPickerTile
                  key={agent.slug}
                  agent={agent}
                  mode="selected"
                  onRemove={removeAgent}
                />
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#61C1C4] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              Save crew
            </button>
            {!canSave && selected.length > 0 && (
              <p className="mt-1.5 text-center text-[10px] text-[#555]">
                {selected.length < MIN_HATS
                  ? `Add at least ${MIN_HATS} hats to save.`
                  : `Maximum ${MAX_HATS} hats.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
