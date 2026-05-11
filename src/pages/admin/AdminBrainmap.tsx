import ReactMarkdown from "react-markdown";
import { BookOpen, Fingerprint, Sparkles } from "lucide-react";
import brainmapMarkdown from "../../../docs/UnClick-brainmap.generated.md?raw";

const sectionCount = (brainmapMarkdown.match(/^## /gm) || []).length;
const sourceCount = (brainmapMarkdown.match(/^\| .* \| [a-f0-9]{12} \| \d+ \|$/gm) || []).length;

export default function AdminBrainmap() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-[#E2B93B]/30 bg-[#E2B93B]/10 px-2.5 py-1 text-xs font-semibold text-[#E2B93B]">
            <Sparkles className="h-3.5 w-3.5" />
            Internal admin only
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Ecosystem Brainmap</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Auto-generated map of UnClick pages, tools, workers, rooms, aliases, safety rules, and
            ledger meaning. This is the system orientation pair to Heartbeat Master.
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <BookOpen className="h-3.5 w-3.5" />
              Sections
            </div>
            <p className="mt-1 font-mono text-2xl text-white">{sectionCount}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <Fingerprint className="h-3.5 w-3.5" />
              Sources
            </div>
            <p className="mt-1 font-mono text-2xl text-white">{sourceCount}</p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-white/[0.06] bg-[#111] p-4">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 className="mb-3 text-xl font-semibold text-white">{children}</h2>,
            h2: ({ children }) => <h3 className="mt-8 border-t border-white/[0.06] pt-5 text-lg font-semibold text-white">{children}</h3>,
            p: ({ children }) => <p className="my-3 max-w-4xl text-sm leading-6 text-white/65">{children}</p>,
            ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5 text-sm leading-6 text-white/65">{children}</ul>,
            code: ({ children }) => <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-[#E2B93B]">{children}</code>,
            table: ({ children }) => <div className="my-4 overflow-x-auto rounded-lg border border-white/[0.06]"><table className="min-w-full text-left text-xs">{children}</table></div>,
            th: ({ children }) => <th className="border-b border-white/[0.08] bg-white/[0.04] px-3 py-2 font-semibold text-white/70">{children}</th>,
            td: ({ children }) => <td className="border-b border-white/[0.04] px-3 py-2 align-top text-white/60">{children}</td>,
          }}
        >
          {brainmapMarkdown}
        </ReactMarkdown>
      </section>
    </div>
  );
}
