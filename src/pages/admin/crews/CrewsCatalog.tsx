import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CrewsNav from "@/components/crews/CrewsNav";
import TemplateCard from "@/components/crews/TemplateCard";
import { CREW_TEMPLATES } from "@/data/mockCrewTemplates";
import { STARTER_CREWS } from "@/data/starterCrews";
import { MOCK_AGENTS } from "@/data/mockAgents";
import type { CrewTemplate } from "@/types/crews";
import { Play, Sparkles } from "lucide-react";

const COLOUR_MAP: Record<string, string> = {
  "crew-exec":     "#61C1C4",
  "crew-creative": "#E2B93B",
  "crew-tech":     "#7FB3D5",
  "crew-think":    "#C39BD3",
  "crew-domain":   "#82E0AA",
  "crew-life":     "#F5B7B1",
  "crew-meta":     "#F7DC6F",
};

export default function CrewsCatalog() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  function handleSelectTemplate(template: CrewTemplate) {
    navigate(`/admin/crews/new?template=${template.slug}`);
  }

  function handleCopyPrompt(id: string, prompt: string) {
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#eee]">Crews</h1>
      <p className="mb-6 text-sm text-[#777]">
        Pick a deliberation template, compose your team from the Agents library, and run.
      </p>
      <CrewsNav />

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#E2B93B]" />
          <h2 className="text-sm font-semibold text-[#ccc]">Starter crews</h2>
          <span className="text-xs text-[#555]">Ready to run. Click the example prompt to copy it.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {STARTER_CREWS.map((crew) => {
            const template = CREW_TEMPLATES.find((t) => t.slug === crew.template_slug);
            const agents = crew.agent_slugs
              .map((slug) => MOCK_AGENTS.find((a) => a.slug === slug))
              .filter(Boolean) as typeof MOCK_AGENTS;
            return (
              <div
                key={crew.id}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5"
              >
                <h3 className="mb-1 text-sm font-semibold text-[#eee]">{crew.name}</h3>
                <p className="mb-3 text-xs text-[#777]">{crew.description}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {agents.map((agent) => {
                    const colour = COLOUR_MAP[agent.colour_token] ?? "#61C1C4";
                    return (
                      <span
                        key={agent.slug}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${colour}18`, color: colour }}
                      >
                        {agent.name}
                      </span>
                    );
                  })}
                  {template && (
                    <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#555]">
                      {template.name}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(crew.id, crew.example_prompt)}
                  className="group w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left text-xs text-[#666] transition-colors hover:border-[#61C1C4]/30 hover:text-[#aaa]"
                  title="Click to copy this example prompt"
                >
                  <span className="text-[#555] group-hover:text-[#888]">Example: </span>
                  {copied === crew.id ? (
                    <span className="text-[#61C1C4]">Copied to clipboard.</span>
                  ) : (
                    <span className="italic">{crew.example_prompt}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/crews/new?template=${crew.template_slug}&starter=${crew.id}`)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#61C1C4]/10 py-2 text-xs font-semibold text-[#61C1C4] transition-colors hover:bg-[#61C1C4]/20"
                >
                  <Play className="h-3 w-3" />
                  Compose crew
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-[#ccc]">Deliberation templates</h2>
        <p className="mb-4 text-xs text-[#555]">
          Six proven patterns. Pick one, then choose which hats run inside it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CREW_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.slug}
              template={template}
              onSelect={handleSelectTemplate}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
