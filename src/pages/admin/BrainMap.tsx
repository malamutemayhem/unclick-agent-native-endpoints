import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/lib/auth";
import {
  Zap, Heart, Clock, CheckCircle2, Circle, Monitor, Plug, Bot,
  Fingerprint, FolderKanban, Code, Lightbulb, Wrench, MessageSquare, Save,
} from "lucide-react";

type BootSummary = {
  last_boot_at: string | null;
  facts_loaded: number;
  context_items_loaded: number;
  sessions_loaded: number;
  project_items_loaded: number;
};

type ContextRow = { category: string };

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

async function tryFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function BrainMap() {
  const { session } = useSession();
  const [bootSummary, setBootSummary] = useState<BootSummary | null>(null);
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [factCount, setFactCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const jwt = session?.access_token ?? "";
    const apiKey = localStorage.getItem("unclick_api_key") ?? "";
    const token = jwt || apiKey;
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      // Use allSettled so a missing admin_boot_summary doesn't block the rest
      const [bootRes, ctxRes, factsRes, sessRes] = await Promise.allSettled([
        tryFetch("/api/memory-admin?action=admin_boot_summary", token),
        tryFetch("/api/memory-admin?action=business_context", token),
        tryFetch("/api/memory-admin?action=facts", token),
        tryFetch("/api/memory-admin?action=sessions&limit=1", token),
      ]);
      if (bootRes.status === "fulfilled")
        setBootSummary(bootRes.value.data ?? bootRes.value ?? null);
      if (ctxRes.status === "fulfilled")
        setContextRows(ctxRes.value.data ?? []);
      if (factsRes.status === "fulfilled")
        setFactCount((factsRes.value.data ?? []).length);
      if (sessRes.status === "fulfilled")
        setSessionCount((sessRes.value.data ?? []).length);
      setLoading(false);
    })();
  }, [session]);

  const identityCount = useMemo(
    () =>
      contextRows.filter(
        (r) =>
          r.category === "identity" ||
          r.category === "preference" ||
          r.category === "standing_rule"
      ).length,
    [contextRows]
  );
  const repoCount = useMemo(
    () => contextRows.filter((r) => r.category === "repository").length,
    [contextRows]
  );
  const hasIdentity     = contextRows.some((r) => r.category === "identity");
  const hasPreference   = contextRows.some((r) => r.category === "preference");
  const hasStandingRule = contextRows.some((r) => r.category === "standing_rule");
  const hasRepo         = repoCount > 0;
  const hasFiveFacts    = factCount >= 5;
  const hasSession      = sessionCount >= 1;

  const checklist = [
    { ok: hasIdentity,     label: "Identity set",        link: "/admin/memory?tab=identity" },
    { ok: hasPreference,   label: "Preferences set",     link: "/admin/memory?tab=identity" },
    { ok: hasFiveFacts,    label: "At least 5 facts",    link: "/admin/memory?tab=facts"    },
    { ok: hasSession,      label: "A saved session",     link: "/admin/memory?tab=sessions" },
    { ok: hasStandingRule, label: "Standing rules",      link: "/admin/memory?tab=identity" },
    { ok: hasRepo,         label: "Repository context",  link: undefined                    },
  ];
  const healthPct = Math.round(
    (checklist.filter((c) => c.ok).length / checklist.length) * 100
  );

  const bootLine = bootSummary
    ? `Last load: ${bootSummary.facts_loaded} facts, ${bootSummary.context_items_loaded} context, ${bootSummary.sessions_loaded} sessions`
    : "No load recorded yet";

  const stages = [
    { num: "0",  title: "Agent's Local Context", sub: "Before UnClick",     desc: "Your AI reads CLAUDE.md, .cursor/rules, or other config files from your machine before connecting.", color: "#888",     icon: Monitor  },
    { num: "1",  title: "MCP Connection",         sub: "Handshake",          desc: "Your AI connects to UnClick via MCP. API key authenticates and identifies your account.",              color: "#61C1C4", icon: Plug     },
    { num: "2",  title: "Agent Profile",           sub: "Who am I?",          desc: "UnClick loads the agent's persona, system prompt, and which memory layers are enabled.",              color: "#a78bfa", icon: Bot      },
    { num: "3",  title: "Identity",                sub: "Who are you?",       desc: `Your brand, preferences, and standing rules. ${identityCount} items stored.`,                         color: "#E2B93B", icon: Fingerprint, link: "/admin/memory?tab=identity" },
    { num: "4",  title: "Project Scope",           sub: "What are we working on?", desc: "If a project is active, project-scoped memory loads alongside global. Project wins on conflicts.", color: "#61C1C4", icon: FolderKanban },
    { num: "5",  title: "Codebase",               sub: "How is the code shaped?",  desc: `Tech stack, deploy process, constraints, gotchas. ${repoCount} items stored.`,                  color: "#4ade80", icon: Code     },
    { num: "6",  title: "Knowledge",              sub: "What do I know?",     desc: `Facts extracted from conversations. ${factCount} items stored.`,                                      color: "#f472b6", icon: Lightbulb, link: "/admin/memory?tab=facts" },
    { num: "7",  title: "Sessions",               sub: "What happened recently?", desc: "Summaries of past conversations. Last 5 load at startup.",                                       color: "#fb923c", icon: Clock,   link: "/admin/memory?tab=sessions" },
    { num: "8",  title: "Tool Guidance",           sub: "What can I use?",    desc: "Connected tools are classified: compatible, conflicting, or replaceable.",                            color: "#61C1C4", icon: Wrench   },
    { num: "9",  title: "Brain Loaded",            sub: "Ready",              desc: bootLine,                                                                                               color: "#E2B93B", icon: Zap      },
    { num: "10", title: "Live Session",            sub: "Working together",   desc: "Your AI searches memory on demand and saves new knowledge as it learns -- not just at session end.", color: "#4ade80", icon: MessageSquare },
    { num: "11", title: "Session End",             sub: "Learning saved",     desc: "Summary written, new facts persisted, old facts decayed. Next session starts smarter.",              color: "#a78bfa", icon: Save     },
  ];

  const phaseLabels: Record<string, { text: string; color: string }> = {
    "0":  { text: "PRE-BOOT",      color: "text-[#888]"     },
    "1":  { text: "BOOT SEQUENCE", color: "text-[#61C1C4]"  },
    "9":  { text: "READY",         color: "text-[#E2B93B]"  },
    "10": { text: "LIVE SESSION",  color: "text-[#4ade80]"  },
    "11": { text: "POST-SESSION",  color: "text-[#a78bfa]"  },
  };

  return (
    <div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* What Loaded */}
        <div className="rounded-xl border border-[#61C1C4]/40 bg-[#111] p-5">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#61C1C4]" />
            <h2 className="text-sm font-semibold text-white">What Loaded</h2>
          </div>
          <p className="mb-4 text-xs text-[#888]">
            What your AI loaded at the most recent session start
          </p>
          <div className="mb-3 grid grid-cols-3 gap-3">
            {(
              [
                ["Facts",   bootSummary?.facts_loaded],
                ["Context", bootSummary?.context_items_loaded],
                ["Sessions",bootSummary?.sessions_loaded],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="rounded-lg bg-white/[0.03] p-3">
                <div className="text-lg font-semibold text-white">{loading ? "--" : (val ?? 0)}</div>
                <div className="text-[10px] uppercase tracking-wide text-[#888]">{label}</div>
              </div>
            ))}
          </div>
          {!loading && (bootSummary?.project_items_loaded ?? 0) > 0 && (
            <p className="mb-2 text-xs text-[#888]">
              Project items: {bootSummary?.project_items_loaded}
            </p>
          )}
          <p className="text-xs text-[#666]">
            Loaded {loading ? "--" : timeAgo(bootSummary?.last_boot_at ?? null)}
          </p>
        </div>

        {/* Memory Health */}
        <div className="rounded-xl border border-[#E2B93B]/40 bg-[#111] p-5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-[#E2B93B]" />
              <h2 className="text-sm font-semibold text-white">Memory Health</h2>
            </div>
            <span className="text-sm font-semibold text-[#E2B93B]">
              {loading ? "--" : `${healthPct}%`}
            </span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-[#E2B93B] transition-all"
              style={{ width: `${loading ? 0 : healthPct}%` }}
            />
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  {item.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#4ade80]" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-[#444]" />
                  )}
                  <span className={item.ok ? "text-[#ccc]" : "text-[#888]"}>{item.label}</span>
                </span>
                {!item.ok && item.link && (
                  <Link to={item.link} className="text-[#61C1C4] hover:underline">
                    add
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Memory Flow</h2>
        <p className="text-xs text-[#888]">
          How your AI builds its understanding, step by step.
        </p>
      </div>

      <div className="relative">
        {stages.map((stage, idx) => {
          const phase = phaseLabels[stage.num];
          const Icon  = stage.icon;
          const isLast = idx === stages.length - 1;
          return (
            <div key={stage.num}>
              {phase && (
                <div className={`mb-2 ml-12 text-[10px] font-bold uppercase tracking-widest ${phase.color}`}>
                  {phase.text}
                </div>
              )}
              <div className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold"
                    style={{ borderColor: stage.color, color: stage.color }}
                  >
                    {stage.num}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-white/20 to-white/[0.04]" />
                  )}
                </div>
                <div className="mb-2 flex-1 rounded-xl border border-white/[0.06] bg-[#111] p-4">
                  <div className="flex items-center">
                    <Icon className="mr-2 h-4 w-4" style={{ color: stage.color }} />
                    {"link" in stage && stage.link ? (
                      <Link
                        to={stage.link}
                        className="text-sm font-semibold text-[#61C1C4] hover:underline"
                      >
                        {stage.title}
                      </Link>
                    ) : (
                      <h3 className="text-sm font-semibold text-white">{stage.title}</h3>
                    )}
                    <span className="ml-2 text-xs text-[#888]">{stage.sub}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#666]">{stage.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
