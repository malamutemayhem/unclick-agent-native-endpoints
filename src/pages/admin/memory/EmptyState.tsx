import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  steps?: string[];
  cta?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, heading, description, steps, cta, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
        <Icon className="h-6 w-6 text-amber-500" />
      </div>
      <h3 className="text-sm font-semibold text-white">{heading}</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/50">{description}</p>
      {steps && steps.length > 0 && (
        <ol className="mt-3 space-y-1 text-left">
          {steps.map((step, i) => (
            <li key={i} className="text-sm text-white/40 pl-1">
              <span className="text-white/50 font-medium">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
      )}
      {cta && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
