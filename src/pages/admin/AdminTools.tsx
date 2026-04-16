/**
 * AdminTools - Tools surface (/admin/tools)
 *
 * Full tool catalog fetched from platform_connectors with category
 * grouping and search/filter. Toggle is a stretch goal.
 * Marketplace tools bolt on here later.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wrench,
  Search,
  Loader2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface Connector {
  id: string;
  name: string;
  category: string;
  auth_type: string;
  description: string | null;
  setup_url: string | null;
  icon: string | null;
  sort_order: number;
}

export default function AdminTools() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // platform_connectors is public (anon_read_connectors policy)
      const { data } = await supabase
        .from("platform_connectors")
        .select("*")
        .order("sort_order");

      if (!cancelled) {
        setConnectors(data ?? []);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Filter
  const filtered = query
    ? connectors.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()) ||
          (c.description ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : connectors;

  // Group by category
  const grouped = filtered.reduce<Record<string, Connector[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Tools</h1>
        <p className="mt-1 text-sm text-[#888]">
          Available integrations and connectors
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
        <input
          type="text"
          placeholder="Search tools..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-white/[0.06] bg-[#111111] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#555] outline-none transition-colors focus:border-[#E2B93B]/30"
        />
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-4 text-xs text-[#666]">
        <span>{filtered.length} tools</span>
        <span>{categories.length} categories</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading tools...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-[#333]" />
          <p className="mt-3 text-sm text-[#666]">
            {query ? "No tools match your search" : "No tools available"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#666]">
                {category}
                <span className="ml-2 text-[10px] font-normal text-[#555]">
                  ({grouped[category].length})
                </span>
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {grouped[category].map((tool) => (
                  <div
                    key={tool.id}
                    className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#111111] p-4 transition-colors hover:border-white/[0.1]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-sm font-semibold text-[#888]">
                        {tool.icon ?? tool.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {tool.name}
                        </p>
                        {tool.description && (
                          <p className="mt-0.5 truncate text-[11px] text-[#666]">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#666]">
                        {tool.auth_type}
                      </span>
                      {tool.setup_url && (
                        <a
                          href={tool.setup_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-1.5 text-[#666] opacity-0 transition-all hover:text-[#ccc] group-hover:opacity-100"
                          title="Setup"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[#444] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Marketplace callout */}
      <div className="mt-8 rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-6 text-center">
        <p className="text-xs text-[#666]">
          Marketplace tools and custom integrations coming soon
        </p>
      </div>
    </div>
  );
}
