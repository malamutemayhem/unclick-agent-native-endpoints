import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  description: string;
  cta?: ReactNode;
}

export default function EmptyState({ icon, heading, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-[#61C1C4]">
        {icon}
      </div>
      <h3 className="mb-2 font-mono text-sm font-semibold text-white">{heading}</h3>
      <p className="mb-6 max-w-md text-sm text-[#AAAAAA]">{description}</p>
      {cta}
    </div>
  );
}
