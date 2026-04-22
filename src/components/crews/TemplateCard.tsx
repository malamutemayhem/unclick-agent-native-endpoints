import type { CrewTemplate } from "@/types/crews";
import {
  UsersRound, Layers, ShieldAlert, Swords, Newspaper, MessageSquare,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "users-round":   UsersRound,
  "layers":        Layers,
  "shield-alert":  ShieldAlert,
  "swords":        Swords,
  "newspaper":     Newspaper,
  "message-square": MessageSquare,
};

interface TemplateCardProps {
  template: CrewTemplate;
  onSelect?: (template: CrewTemplate) => void;
}

export default function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const Icon = ICONS[template.icon] ?? UsersRound;
  return (
    <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.03] p-5 transition-colors hover:border-[#61C1C4]/40 hover:bg-[#61C1C4]/5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#61C1C4]/10 text-[#61C1C4]">
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-[#888]">
          {template.hat_count} {template.hat_count === 1 ? "hat" : "hats"}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-[#eee]">{template.name}</h3>
      <p className="mt-0.5 text-xs text-[#61C1C4]/80">{template.use_when}</p>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-[#888]">{template.description}</p>
      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(template)}
          className="mt-4 w-full rounded-lg bg-[#61C1C4]/10 py-2 text-xs font-semibold text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20"
        >
          Use this template
        </button>
      )}
    </div>
  );
}
