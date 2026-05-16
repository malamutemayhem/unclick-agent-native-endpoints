import FadeIn from "../FadeIn";
import { PLATFORM_CONNECTOR_NAMES } from "./constants";
import { ToolCard } from "./ToolCards";
import type { Category, ConnectorStatus, TestPassScore, Tool } from "./types";

interface ToolGridProps {
  activeCategory: Category;
  connectorStatus: ConnectorStatus;
  testPassScores: Record<string, TestPassScore>;
  useSections: boolean;
  visible: Tool[];
  visibleLocal: Tool[];
  visiblePlatform: Tool[];
  searchQuery: string;
  onSelectTool: (tool: Tool) => void;
}

export function ToolGrid({
  activeCategory,
  connectorStatus,
  testPassScores,
  useSections,
  visible,
  visibleLocal,
  visiblePlatform,
  searchQuery,
  onSelectTool,
}: ToolGridProps) {
  return (
    <>
      {useSections ? (
        <>
          {activeCategory !== "Platform" && visibleLocal.length > 0 && (
            <div className="mb-12">
              <FadeIn>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-xl font-semibold text-heading">Works out of the box</h2>
                    <span className="rounded-full border border-border/50 bg-card/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {visibleLocal.length} tools
                    </span>
                  </div>
                  <p className="text-sm text-body max-w-2xl">
                    These tools run entirely inside the MCP server. No API keys, no accounts, no external setup. Just call and go.
                  </p>
                </div>
              </FadeIn>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {visibleLocal.map((tool, i) => (
                  <ToolCard
                    key={tool.name}
                    connectorStatus={connectorStatus}
                    delay={Math.min(i * 0.03, 0.3)}
                    isPlatform={false}
                    scoreMap={testPassScores}
                    showNoApiKeyBadge
                    tool={tool}
                    onSelect={onSelectTool}
                  />
                ))}
              </div>
            </div>
          )}

          {activeCategory === "All" && visibleLocal.length > 0 && visiblePlatform.length > 0 && (
            <div className="my-10 flex items-center gap-4">
              <div className="h-px flex-1 bg-border/30" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60">
                Platform Connectors
              </span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
          )}

          {activeCategory !== "Local" && visiblePlatform.length > 0 && (
            <div>
              <FadeIn>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-xl font-semibold text-heading">Connect once. Works forever.</h2>
                    <span className="rounded-full border border-border/50 bg-card/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {visiblePlatform.length} connectors
                    </span>
                  </div>
                  <p className="text-sm text-body max-w-2xl">
                    Connect your accounts one time. Your AI agent handles the rest, with no Passport setup needed on every call.
                  </p>
                </div>
              </FadeIn>
              <div className="rounded-2xl border border-border/30 bg-card/20 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {visiblePlatform.map((tool, i) => (
                    <ToolCard
                      key={tool.name}
                      connectorStatus={connectorStatus}
                      delay={Math.min(i * 0.03, 0.3)}
                      isPlatform
                      scoreMap={testPassScores}
                      tool={tool}
                      onSelect={onSelectTool}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((tool, i) => {
            const isPlatform = PLATFORM_CONNECTOR_NAMES.has(tool.name);

            return (
              <ToolCard
                key={tool.name}
                connectorStatus={connectorStatus}
                delay={Math.min(i * 0.03, 0.3)}
                isPlatform={isPlatform}
                scoreMap={testPassScores}
                showNoApiKeyBadge={false}
                tool={tool}
                onSelect={onSelectTool}
              />
            );
          })}
        </div>
      )}

      {visible.length === 0 && (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          No tools match "{searchQuery}". Try a different search.
        </div>
      )}
    </>
  );
}
