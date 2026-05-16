import FadeIn from "../FadeIn";
import type { Category } from "./types";

interface ToolSearchProps {
  localSearch: string;
  quickLinks: { label: string; category: Category }[];
  toolsDisplay: string;
  onCategorySelect: (category: Category) => void;
  onSearchChange: (value: string) => void;
}

export function ToolSearch({
  localSearch,
  quickLinks,
  toolsDisplay,
  onCategorySelect,
  onSearchChange,
}: ToolSearchProps) {
  return (
    <FadeIn>
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${toolsDisplay} tools...`}
            className="w-full rounded-xl border border-border/60 bg-card/50 px-4 py-2.5 pl-9 text-sm text-heading placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 backdrop-blur-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Jump to:</span>
          {quickLinks.map(({ label, category }) => (
            <button
              key={label}
              onClick={() => {
                onCategorySelect(category);
                onSearchChange("");
              }}
              className="rounded-full border border-border/50 px-3 py-0.5 text-xs text-body hover:border-primary/40 hover:text-heading transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}
