import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import FadeIn from "../FadeIn";
import { categoryColors, categoryIconBg, NO_API_KEY_TOOLS, PLATFORM_CONNECTOR_SLUGS } from "./constants";
import { TestPassBadge } from "./TestPassBadge";
import { testPassKeyForTool } from "./testPass";
import type { ConnectorStatus, TestPassScore, Tool } from "./types";

interface LocalToolCardProps {
  delay: number;
  score?: TestPassScore;
  showNoApiKeyBadge?: boolean;
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export function LocalToolCard({
  delay,
  score,
  showNoApiKeyBadge = true,
  tool,
  onSelect,
}: LocalToolCardProps) {
  const showNoApiKey = showNoApiKeyBadge && NO_API_KEY_TOOLS.has(tool.name);

  return (
    <FadeIn delay={delay}>
      <motion.button
        onClick={() => onSelect(tool)}
        className="group relative w-full text-left flex flex-col rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
      >
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
          <tool.Icon size={18} strokeWidth={1.75} />
        </div>
        <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
        <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2 flex-1">{tool.description}</p>
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
            {tool.category}
          </span>
          {showNoApiKey ? (
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/20">
              No API key
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              No setup
            </span>
          )}
          <TestPassBadge score={score} />
        </div>
      </motion.button>
    </FadeIn>
  );
}

interface PlatformToolCardProps {
  connectorStatus: ConnectorStatus;
  delay: number;
  score?: TestPassScore;
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export function PlatformToolCard({
  connectorStatus,
  delay,
  score,
  tool,
  onSelect,
}: PlatformToolCardProps) {
  const slug = PLATFORM_CONNECTOR_SLUGS[tool.name] ?? tool.name.toLowerCase();
  const connectHref = tool.name === "Passport" ? "/admin/keychain" : `/connect/${slug}`;
  const isConnected = connectorStatus[slug] === "connected";

  return (
    <FadeIn delay={delay}>
      <motion.div
        className="relative flex flex-col rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm transition-all overflow-hidden hover:border-primary/40 hover:bg-card hover:shadow-[0_0_20px_2px_rgba(226,185,59,0.07)]"
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${categoryIconBg[tool.category]}`}>
            <tool.Icon size={18} strokeWidth={1.75} />
          </div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 shrink-0">
              <CheckCircle2 size={9} />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted/30 border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
              Setup required
            </span>
          )}
        </div>

        <button
          onClick={() => onSelect(tool)}
          className="text-left flex-1 focus:outline-none"
        >
          <span className="text-sm font-semibold text-heading leading-snug">{tool.name}</span>
          <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-2">{tool.description}</p>
        </button>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[tool.category]}`}>
              {tool.category}
            </span>
            <TestPassBadge score={score} />
          </div>
          <a
            href={connectHref}
            className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {tool.name === "Passport" ? "Open" : isConnected ? "Manage" : "Connect"}
          </a>
        </div>
      </motion.div>
    </FadeIn>
  );
}

interface ToolCardProps {
  connectorStatus: ConnectorStatus;
  isPlatform: boolean;
  delay: number;
  scoreMap: Record<string, TestPassScore>;
  showNoApiKeyBadge?: boolean;
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export function ToolCard({
  connectorStatus,
  isPlatform,
  delay,
  scoreMap,
  showNoApiKeyBadge,
  tool,
  onSelect,
}: ToolCardProps) {
  const score = scoreMap[testPassKeyForTool(tool)];

  if (isPlatform) {
    return (
      <PlatformToolCard
        connectorStatus={connectorStatus}
        delay={delay}
        score={score}
        tool={tool}
        onSelect={onSelect}
      />
    );
  }

  return (
    <LocalToolCard
      delay={delay}
      score={score}
      showNoApiKeyBadge={showNoApiKeyBadge}
      tool={tool}
      onSelect={onSelect}
    />
  );
}
