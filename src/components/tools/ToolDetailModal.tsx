import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { categoryColors, categoryIconBg, PLATFORM_CONNECTOR_NAMES, PLATFORM_CONNECTOR_SLUGS } from "./constants";
import type { ConnectorStatus, Tool } from "./types";

interface ToolDetailModalProps {
  connectorStatus: ConnectorStatus;
  hasKey: boolean;
  selectedTool: Tool | null;
  onClose: () => void;
  onGetStarted: () => void;
}

export function ToolDetailModal({
  connectorStatus,
  hasKey,
  selectedTool,
  onClose,
  onGetStarted,
}: ToolDetailModalProps) {
  return (
    <AnimatePresence>
      {selectedTool && (() => {
        const isPlatform = PLATFORM_CONNECTOR_NAMES.has(selectedTool.name);
        const slug = isPlatform ? (PLATFORM_CONNECTOR_SLUGS[selectedTool.name] ?? selectedTool.name.toLowerCase()) : null;
        const connectHref = selectedTool.name === "Passport" ? "/admin/keychain" : `/connect/${slug}`;
        const isConnected = slug ? connectorStatus[slug] === "connected" : false;

        return (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-card hover:text-heading transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${categoryIconBg[selectedTool.category]}`}>
                  <selectedTool.Icon size={22} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-heading">{selectedTool.name}</h3>
                    {isPlatform ? (
                      isConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <CheckCircle2 size={10} />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted/30 border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Setup required
                        </span>
                      )
                    ) : hasKey ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 size={10} />
                        Connected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[selectedTool.category]}`}>
                      {selectedTool.category}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                      Free
                    </span>
                    {isPlatform && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                        Platform Connector
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm text-body leading-relaxed">{selectedTool.description}</p>

              <div className="mt-4">
                <p className="text-xs font-medium text-heading mb-2 uppercase tracking-widest font-mono opacity-60">What it can do</p>
                <ul className="space-y-1.5">
                  {selectedTool.capabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-2 text-xs text-body">
                      <span className="mt-0.5 shrink-0 text-primary opacity-70">-</span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-lg border border-border/40 bg-background/60 px-4 py-3">
                <span className="block font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Example</span>
                <p className="text-xs text-body leading-relaxed italic">"{selectedTool.examplePrompt}"</p>
              </div>

              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Endpoint</span>
                <code className="font-mono text-xs text-primary">{selectedTool.endpoint}</code>
              </div>

              <div className="mt-5 flex gap-3">
                {isPlatform ? (
                  <>
                    <a
                      href={connectHref}
                      className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                        isConnected
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {selectedTool.name === "Passport" ? "Open Passport" : isConnected ? "Manage connection" : "Connect account"}
                    </a>
                    <a
                      href="/docs"
                      className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                    >
                      Docs
                    </a>
                  </>
                ) : hasKey ? (
                  <>
                    <button
                      onClick={onGetStarted}
                      className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-center text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      You're connected
                    </button>
                    <a
                      href="/docs"
                      className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                    >
                      Docs
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onGetStarted}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Get Started, free
                    </button>
                    <a
                      href="/docs"
                      className="rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-heading hover:border-border transition-colors"
                    >
                      Docs
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          </>
        );
      })()}
    </AnimatePresence>
  );
}
