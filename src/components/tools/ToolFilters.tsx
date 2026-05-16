import FadeIn from "../FadeIn";
import type { Category } from "./types";

interface ToolFiltersProps {
  activeCategory: Category;
  categories: Category[];
  visibleCount: number;
  onCategoryChange: (category: Category) => void;
}

export function ToolFilters({
  activeCategory,
  categories,
  visibleCount,
  onCategoryChange,
}: ToolFiltersProps) {
  return (
    <FadeIn>
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-[0_0_12px_2px_rgba(226,185,59,0.2)]"
                : "border border-border/60 text-muted-foreground hover:border-primary/30 hover:text-heading"
            }`}
          >
            {cat}
          </button>
        ))}
        <span className="ml-auto flex items-center font-mono text-xs text-muted-foreground self-center">
          {visibleCount} tool{visibleCount !== 1 ? "s" : ""}
        </span>
      </div>
    </FadeIn>
  );
}
