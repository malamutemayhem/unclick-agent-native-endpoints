import type { Agent } from "@/types/crews";
import { Plus, X, Copy } from "lucide-react";

const COLOUR_MAP: Record<string, string> = {
  "crew-exec":     "#61C1C4",
  "crew-creative": "#E2B93B",
  "crew-tech":     "#7FB3D5",
  "crew-think":    "#C39BD3",
  "crew-domain":   "#82E0AA",
  "crew-life":     "#F5B7B1",
  "crew-meta":     "#F7DC6F",
};

interface AgentPickerTileProps {
  agent: Agent;
  mode: "pick" | "selected";
  onAdd?: (agent: Agent) => void;
  onRemove?: (agent: Agent) => void;
  onClone?: (agent: Agent) => void;
  disabled?: boolean;
  cloning?: boolean;
}

export default function AgentPickerTile({
  agent, mode, onAdd, onRemove, onClone, disabled, cloning,
}: AgentPickerTileProps) {
  const colour = COLOUR_MAP[agent.colour_token] ?? "#61C1C4";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
        mode === "selected"
          ? "border-white/[0.10] bg-white/[0.04]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
        style={{ backgroundColor: `${colour}18`, color: colour }}
      >
        {agent.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#ddd]">{agent.name}</p>
        <p className="truncate text-[10px] text-[#666]">{agent.hook}</p>
      </div>
      {mode === "pick" && agent.is_system && onClone && (
        <button
          type="button"
          onClick={() => onClone(agent)}
          disabled={cloning}
          className="shrink-0 rounded-md p-1 text-[#555] transition-colors hover:bg-amber-500/10 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          title="Clone to edit"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
      {mode === "pick" && onAdd && (
        <button
          type="button"
          onClick={() => onAdd(agent)}
          disabled={disabled}
          className="shrink-0 rounded-md p-1 text-[#555] transition-colors hover:bg-[#61C1C4]/10 hover:text-[#61C1C4] disabled:cursor-not-allowed disabled:opacity-40"
          title={`Add ${agent.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      {mode === "selected" && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(agent)}
          className="shrink-0 rounded-md p-1 text-[#555] transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          title={`Remove ${agent.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
