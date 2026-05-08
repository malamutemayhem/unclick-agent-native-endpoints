/**
 * AdminAgents - manage AI agent profiles.
 *
 * Users can create named agents with a role, system prompt, scoped tool
 * access, and scoped memory layer access. Wires through /api/memory-admin
 * actions admin_agent_*.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Power,
  Star,
  Search,
  X,
  Check,
  Cpu,
  Gauge,
  AlertTriangle,
  Save,
} from "lucide-react";
import {
  AGENT_TEMPLATES,
  CREW_CATEGORIES,
  MEMORY_LAYERS,
  type AgentTemplate,
  type MemoryLayerKey,
} from "./agentTemplates";

interface Agent {
  id: string;
  api_key_hash: string;
  name: string;
  slug: string;
  role: string;
  description: string | null;
  system_prompt: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  tool_count?: number;
  memory_layer_count?: number;
}

interface Connector {
  id: string;
  name: string;
  category: string;
  description: string | null;
  icon: string | null;
}

interface AgentDetail {
  agent: Agent;
  tools: Array<{ connector_id: string; is_enabled: boolean }>;
  memory_scope: Array<{ memory_layer: string; is_enabled: boolean }>;
}

const ROLE_OPTIONS = [
  { value: "researcher", label: "Researcher" },
  { value: "developer", label: "Developer" },
  { value: "architect", label: "Architect" },
  { value: "qa_engineer", label: "QA Engineer" },
  { value: "security_officer", label: "Security Officer" },
  { value: "designer", label: "Designer" },
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "writer", label: "Writer" },
  { value: "finance_lead", label: "Finance Lead" },
  { value: "legal_advisor", label: "Legal Advisor" },
  { value: "organiser", label: "Organiser" },
  { value: "customer_advocate", label: "Customer Advocate" },
  { value: "devils_advocate", label: "Devil's Advocate" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

// Role slug -> Lucide icon, used to render an agent's icon when no avatar URL is set.
const ROLE_ICON_MAP = new Map(
  AGENT_TEMPLATES.map((t) => [t.role, t.icon] as const),
);

const WORKER_ROLES = [
  { name: "Coordinator", emoji: "🧭", summary: "Routes work and keeps the plan moving.", required: true },
  { name: "Builder", emoji: "🛠️", summary: "Makes scoped changes and opens proof-backed work.", required: true },
  { name: "Tester", emoji: "🧪", summary: "Runs checks and proves the work behaves.", required: true },
  { name: "Reviewer", emoji: "🔍", summary: "Checks the finished work before it moves forward.", required: true },
  { name: "Safety Checker", emoji: "🛡️", summary: "Stops risky work, secret leaks, and unsafe merges.", required: true },
  { name: "Researcher", emoji: "🔬", summary: "Gathers context before work starts.", required: false },
  { name: "Planner", emoji: "📋", summary: "Turns goals into small ordered jobs.", required: false },
  { name: "Messenger", emoji: "📣", summary: "Posts clean handoffs and status packets.", required: false },
  { name: "Watcher", emoji: "👁️", summary: "Keeps an eye on stale queues and missed signals.", required: false },
  { name: "Publisher", emoji: "🚀", summary: "Handles publish proof after work lands.", required: false },
  { name: "Repairer", emoji: "🩹", summary: "Fixes small blockers found by checks.", required: false },
  { name: "Improver", emoji: "♻️", summary: "Turns repeated friction into new build work.", required: false },
] as const;

interface AISeat {
  id: string;
  name: string;
  emoji: string;
  provider: string;
  device: string;
  status: "Ready" | "Standby" | "Needs login";
  state: string;
  load: number;
  assigned: string;
  issue: string;
  isVirtual?: boolean;
}

const AI_SEAT_STORAGE_KEY = "unclick_ai_seat_manual_slots_v1";

const AI_SEAT_EMOJI_OPTIONS = [
  { emoji: "🤖", label: "Robot" },
  { emoji: "🧠", label: "Brain" },
  { emoji: "🛰️", label: "Relay" },
  { emoji: "🧭", label: "Navigator" },
  { emoji: "⚡", label: "Fast" },
  { emoji: "💡", label: "Ideas" },
  { emoji: "🔍", label: "Reviewer" },
  { emoji: "🛠️", label: "Builder" },
  { emoji: "🧪", label: "Tester" },
  { emoji: "🛡️", label: "Safety" },
  { emoji: "📣", label: "Courier" },
  { emoji: "👁️", label: "Watcher" },
  { emoji: "🚀", label: "Publisher" },
  { emoji: "♻️", label: "Improver" },
  { emoji: "🧰", label: "Toolkit" },
  { emoji: "📡", label: "Signal" },
  { emoji: "🧬", label: "System" },
  { emoji: "🗂️", label: "Organizer" },
  { emoji: "📋", label: "Planner" },
  { emoji: "🔬", label: "Research" },
  { emoji: "💻", label: "Desktop" },
  { emoji: "⌨️", label: "Keyboard" },
  { emoji: "🧑‍💻", label: "Coder" },
  { emoji: "🕹️", label: "Control" },
  { emoji: "🎛️", label: "Console" },
  { emoji: "🧱", label: "Stack" },
  { emoji: "🔐", label: "Secure" },
  { emoji: "✅", label: "Checker" },
  { emoji: "🌐", label: "Web" },
  { emoji: "✨", label: "Creative" },
] as const;

const AI_SEATS: AISeat[] = [
  {
    id: "seat-1",
    name: "AI Seat 1",
    emoji: "🤖",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Manual slot",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-2",
    name: "AI Seat 2",
    emoji: "🤖",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Manual slot",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-3",
    name: "AI Seat 3",
    emoji: "🤖",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Manual slot",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "seat-4",
    name: "AI Seat 4",
    emoji: "🤖",
    provider: "Unknown AI",
    device: "Unknown device",
    status: "Ready",
    state: "Manual slot",
    load: 25,
    assigned: "General capacity",
    issue: "",
  },
  {
    id: "virtual-review",
    name: "Virtual review seat",
    emoji: "🧪",
    provider: "Virtual support",
    device: "Spawned when physical capacity is unavailable",
    status: "Standby",
    state: "Fallback only",
    load: 0,
    assigned: "Review / fallback",
    issue: "",
    isVirtual: true,
  },
];

function loadSeatOverrides(): AISeat[] {
  if (typeof window === "undefined") return AI_SEATS;
  try {
    const overrides = JSON.parse(window.localStorage.getItem(AI_SEAT_STORAGE_KEY) ?? "{}") as Record<string, Partial<AISeat>>;
    return AI_SEATS.map((seat) => ({ ...seat, ...(overrides[seat.id] ?? {}) }));
  } catch {
    return AI_SEATS;
  }
}

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("unclick_api_key") ?? "";
}

async function api<T>(action: string, opts: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`/api/memory-admin?action=${action}`, { ...opts, headers });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgentDetail | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [activeView, setActiveView] = useState<"workers" | "seats">("workers");
  const [autoBalance, setAutoBalance] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setHasApiKey(false);
        setLoading(false);
        return;
      }
      setHasApiKey(true);
      const [agentsRes, connectorsRes] = await Promise.all([
        api<{ data: Agent[] }>("admin_agents_list"),
        api<{ data: Connector[] }>("admin_connectors_list"),
      ]);
      setAgents(agentsRes.data ?? []);
      setConnectors(connectorsRes.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const defaultAgent = useMemo(() => agents.find((a) => a.is_default), [agents]);
  const noDefaultWarning = agents.length > 0 && !defaultAgent;

  const handleCreate = async (template: AgentTemplate | null) => {
    setShowTemplates(false);
    try {
      const body = template
        ? {
            name: template.name,
            role: template.role,
            description: template.description,
            system_prompt: template.system_prompt,
            is_default: agents.length === 0,
          }
        : {
            name: "New Agent",
            role: "custom",
            description: "",
            system_prompt: "",
            is_default: agents.length === 0,
          };
      const { agent } = await api<{ agent: Agent }>("admin_agent_create", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (template) {
        const slugSet = new Set(template.tool_slugs);
        const matchedConnectorIds = connectors
          .filter((c) => slugSet.has(c.id))
          .map((c) => c.id);
        if (matchedConnectorIds.length > 0) {
          await api("admin_agent_tools_update", {
            method: "POST",
            body: JSON.stringify({
              agent_id: agent.id,
              connector_ids: matchedConnectorIds,
            }),
          });
        }
        const layers = MEMORY_LAYERS.map((l) => ({
          memory_layer: l.key,
          is_enabled: template.memory_layers.includes(l.key),
        }));
        await api("admin_agent_memory_update", {
          method: "POST",
          body: JSON.stringify({ agent_id: agent.id, layers }),
        });
      }

      await refresh();
      void openEditor(agent.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openEditor = async (agentId: string) => {
    try {
      const detail = await api<AgentDetail>(`admin_agent_get&agent_id=${agentId}`);
      setEditing(detail);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDuplicate = async (agentId: string) => {
    try {
      await api("admin_agent_duplicate", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      await api("admin_agent_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: agent.id, is_active: !agent.is_active }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSetDefault = async (agentId: string) => {
    try {
      await api("admin_agent_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId, is_default: true }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm("Delete this agent? This cannot be undone.")) return;
    try {
      await api("admin_agent_delete", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId }),
      });
      setEditing(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-heading">Workers</h1>
        <p className="mt-1 text-sm text-body">
          UnClick Workers are the roles. AI Seats are the connected AI capacity behind them.
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-border/40 bg-card/20 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveView("workers")}
            className={`rounded-lg border p-4 text-left transition-colors ${
              activeView === "workers"
                ? "border-primary/40 bg-primary/10"
                : "border-border/40 bg-card/30 hover:border-border/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-heading">UnClick Workers</span>
            </div>
            <p className="mt-1 text-xs text-body">
              The roles UnClick can assign work to, like Coordinator, Builder, Reviewer, and Safety Checker.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("seats")}
            className={`rounded-lg border p-4 text-left transition-colors ${
              activeView === "seats"
                ? "border-primary/40 bg-primary/10"
                : "border-border/40 bg-card/30 hover:border-border/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-heading">AI Seats</span>
            </div>
            <p className="mt-1 text-xs text-body">
              The connected AI accounts UnClick can use as capacity. Manual distribution is active for now.
            </p>
          </button>
        </div>
      </div>

      {activeView === "seats" && (
        <AISeatsPanel autoBalance={autoBalance} setAutoBalance={setAutoBalance} />
      )}

      {activeView === "workers" && (
        <>
          <WorkerRolesPanel />

      {!hasApiKey && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-body">
          <p className="font-medium text-heading">Sign in to manage workers</p>
          <p className="mt-1 text-xs">
            Drop your UnClick API key in localStorage as <code>unclick_api_key</code> to load this
            page.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {hasApiKey && agents.length === 0 && !loading && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm text-body">
          <p className="font-medium text-heading">You haven't created any custom workers yet.</p>
          <p className="mt-1 text-xs">
            UnClick is using default settings. All apps and all memory are available to every AI
            session. Create a worker to customise what your AI can do.
          </p>
        </div>
      )}

      {noDefaultWarning && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-body">
          <p className="font-medium text-heading">No default worker selected.</p>
          <p className="mt-1 text-xs">
            Pick one of your workers as the default so it loads automatically when you start a new
            AI session.
          </p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {agents.length} custom {agents.length === 1 ? "worker" : "workers"}
        </p>
        <button
          type="button"
          onClick={() => setShowTemplates(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Worker
        </button>
      </div>

      {loading && hasApiKey ? (
        <p className="text-xs text-muted-foreground">Loading workers...</p>
      ) : (
        <ul className="space-y-3">
          {agents.map((agent) => {
            const RoleIcon = ROLE_ICON_MAP.get(agent.role);
            return (
              <li
                key={agent.id}
                className="rounded-xl border border-border/40 bg-card/20 p-5 transition-colors hover:border-border/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="h-10 w-10 rounded-xl object-cover"
                        />
                      ) : RoleIcon ? (
                        <RoleIcon className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-heading">{agent.name}</h3>
                        {agent.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                            <Star className="h-3 w-3" /> default
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                            agent.is_active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/50 bg-card/40 text-muted-foreground"
                          }`}
                        >
                          {agent.is_active ? "active" : "inactive"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-body">
                        {agent.description ?? "No description"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Tools: {agent.tool_count === 0 ? "all" : agent.tool_count} ·
                        Memory:{" "}
                        {agent.memory_layer_count === 0
                          ? "all layers"
                          : `${agent.memory_layer_count} of ${MEMORY_LAYERS.length}`}{" "}
                        · Role: {agent.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!agent.is_default && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(agent.id)}
                        title="Make default"
                        className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-amber-400"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditor(agent.id)}
                      title="Edit"
                      className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(agent.id)}
                      title="Duplicate"
                      className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(agent)}
                      title={agent.is_active ? "Disable" : "Enable"}
                      className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(agent.id)}
                      title="Delete"
                      className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showTemplates && (
        <TemplatePicker onPick={handleCreate} onClose={() => setShowTemplates(false)} />
      )}

      {editing && (
        <AgentEditor
          detail={editing}
          connectors={connectors}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
          onDelete={() => editing && handleDelete(editing.agent.id)}
        />
      )}
        </>
      )}
    </div>
  );
}

function WorkerRolesPanel() {
  return (
    <section className="mb-6 rounded-xl border border-border/40 bg-card/20 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-heading">Built-in roles</h2>
        <p className="mt-1 text-xs text-body">
          These are the jobs inside UnClick. They are separate from the AI accounts that power them.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {WORKER_ROLES.map((role) => (
          <div key={role.name} className="rounded-lg border border-border/40 bg-card/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{role.emoji}</span>
                <span className="text-xs font-semibold text-heading">{role.name}</span>
              </div>
              <span className="rounded-full border border-border/40 bg-card/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                {role.required ? "Required" : "Optional"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-body">{role.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AISeatsPanel({
  autoBalance,
  setAutoBalance,
}: {
  autoBalance: boolean;
  setAutoBalance: (value: boolean) => void;
}) {
  const [seats, setSeats] = useState<AISeat[]>(() => loadSeatOverrides());
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const issues = seats.filter((seat) => seat.issue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const overrides = Object.fromEntries(
      seats.map((seat) => [
        seat.id,
        {
          name: seat.name,
          emoji: seat.emoji,
          provider: seat.provider,
          device: seat.device,
          load: seat.load,
          assigned: seat.assigned,
        },
      ]),
    );
    window.localStorage.setItem(AI_SEAT_STORAGE_KEY, JSON.stringify(overrides));
  }, [seats]);

  const updateSeat = (seatId: string, patch: Partial<AISeat>) => {
    setSeats((current) => current.map((seat) => (seat.id === seatId ? { ...seat, ...patch } : seat)));
  };

  const spreadEvenly = () => {
    const physical = seats.filter((seat) => !seat.isVirtual);
    const share = physical.length > 0 ? Math.floor(100 / physical.length) : 0;
    const remainder = physical.length > 0 ? 100 - share * physical.length : 0;
    let physicalIndex = 0;
    setSeats((current) =>
      current.map((seat) => {
        if (seat.isVirtual) return { ...seat, load: 0 };
        const load = share + (physicalIndex < remainder ? 1 : 0);
        physicalIndex += 1;
        return { ...seat, load };
      }),
    );
  };

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-border/40 bg-card/20 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-heading">Connected capacity</h2>
            <p className="mt-1 max-w-2xl text-xs text-body">
              AI Seats are capacity slots behind the workers. Live platform/device detection is not wired here yet, so unknown seats stay generic until UnClick has real metadata.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={spreadEvenly}
              className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs font-semibold text-heading transition-colors hover:border-primary/40"
            >
              Even split
            </button>
            <label className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs text-heading">
              <span className="font-semibold">Auto paused</span>
              <button
                type="button"
                onClick={() => setAutoBalance(false)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  autoBalance ? "bg-primary" : "bg-muted"
                }`}
                aria-pressed={autoBalance}
                title="Auto-balance plumbing is kept, but manual distribution is active for now."
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform ${
                    autoBalance ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/40 bg-card/30 p-4">
          <div className="flex items-start gap-3">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-body">
              Manual mode is the default. If only one physical seat is available, keep space for virtual review/fallback support. With multiple physical seats, start even and adjust by hand.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/40 bg-card/20">
        <div className="grid grid-cols-[minmax(210px,1.4fr)_110px_130px_minmax(180px,1.2fr)_minmax(190px,1fr)] gap-3 border-b border-border/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Seat</span>
          <span>Status</span>
          <span>Manual load</span>
          <span>Assigned work</span>
          <span>Controls</span>
        </div>
        <div className="divide-y divide-border/30">
          {seats.map((seat) => {
            const editing = editingSeatId === seat.id;
            const emojiOptions = AI_SEAT_EMOJI_OPTIONS.some((option) => option.emoji === seat.emoji)
              ? AI_SEAT_EMOJI_OPTIONS
              : [{ emoji: seat.emoji, label: "Custom" }, ...AI_SEAT_EMOJI_OPTIONS];
            return (
              <div
                key={seat.id}
                className="grid grid-cols-[minmax(210px,1.4fr)_110px_130px_minmax(180px,1.2fr)_minmax(190px,1fr)] items-center gap-3 px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  {editing ? (
                    <div className="space-y-1">
                      <div className="grid grid-cols-[92px_1fr] gap-1">
                        <select
                          value={seat.emoji}
                          onChange={(event) => updateSeat(seat.id, { emoji: event.target.value })}
                          className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs text-heading outline-none focus:border-primary/40"
                          aria-label="Seat emoji"
                        >
                          {emojiOptions.map((option) => (
                            <option key={`${seat.id}-${option.emoji}`} value={option.emoji}>
                              {option.emoji} {option.label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={seat.name}
                          onChange={(event) => updateSeat(seat.id, { name: event.target.value })}
                          className="rounded-md border border-border/40 bg-card/40 px-2 py-1 text-xs text-heading outline-none focus:border-primary/40"
                          aria-label="Seat name"
                        />
                      </div>
                      <input
                        value={seat.provider}
                        onChange={(event) => updateSeat(seat.id, { provider: event.target.value })}
                        className="w-full rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[10px] text-body outline-none focus:border-primary/40"
                        aria-label="Seat provider"
                      />
                      <input
                        value={seat.device}
                        onChange={(event) => updateSeat(seat.id, { device: event.target.value })}
                        className="w-full rounded-md border border-border/40 bg-card/40 px-2 py-1 text-[10px] text-body outline-none focus:border-primary/40"
                        aria-label="Seat device"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="truncate font-semibold text-heading">
                        <span className="mr-1.5" aria-hidden="true">{seat.emoji}</span>
                        {seat.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{seat.provider}</p>
                      <p className="text-[10px] text-muted-foreground">{seat.device}</p>
                    </>
                  )}
                </div>
                <div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      seat.status === "Ready"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : seat.status === "Standby"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : "border-border/40 bg-card/40 text-muted-foreground"
                    }`}
                  >
                    {seat.status}
                  </span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{seat.state}</p>
                </div>
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={seat.load}
                    onChange={(event) => updateSeat(seat.id, { load: Number(event.target.value) })}
                    className="w-full accent-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{seat.load}%</p>
                </div>
                <input
                  value={seat.assigned}
                  onChange={(event) => updateSeat(seat.id, { assigned: event.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-body outline-none transition-colors focus:border-border/40 focus:bg-card/40 focus:px-2"
                  aria-label={`${seat.name} assigned work`}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={editing ? "Save seat edits" : "Edit seat"}
                    onClick={() => setEditingSeatId(editing ? null : seat.id)}
                    className="rounded-md border border-border/40 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {editing ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                  {seat.issue ? (
                    <span className="text-[10px] text-amber-300">{seat.issue}</span>
                  ) : seat.isVirtual ? (
                    <span className="text-[10px] text-amber-300">Fallback</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Manual</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[#61C1C4]/25 bg-[#61C1C4]/5 p-4 text-xs text-body">
        This page is currently a manual capacity planner. When UnClick has trusted live seat metadata, provider/device names can be filled automatically. Until then, generic AI Seat labels avoid guessing.
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-heading">Needs attention</h3>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-body">
            {issues.map((seat) => (
              <li key={seat.id}>
                <span className="font-medium text-heading">{seat.name}:</span> {seat.issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (template: AgentTemplate | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/40 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Start from a template</h2>
            <p className="mt-1 text-xs text-body">
              Each template ships with a sensible system prompt, role, and starter tool selection.
              You can edit everything after creating.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {CREW_CATEGORIES.map((cat) => {
              const members = AGENT_TEMPLATES.filter((t) => t.category === cat.key);
              if (members.length === 0) return null;
              return (
                <div key={cat.key}>
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">{cat.hint}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {members.map((tpl) => {
                      const Icon = tpl.icon;
                      return (
                        <button
                          key={tpl.role}
                          type="button"
                          onClick={() => onPick(tpl)}
                          className="rounded-lg border border-border/40 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold text-heading">{tpl.name}</span>
                            <span className="rounded-full border border-border/40 bg-card/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {tpl.role}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-body">{tpl.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Start blank
              </p>
              <button
                type="button"
                onClick={() => onPick(null)}
                className="w-full rounded-lg border border-dashed border-border/50 bg-card/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-heading">Custom</span>
                  <span className="rounded-full border border-border/40 bg-card/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    blank
                  </span>
                </div>
                <p className="mt-1 text-xs text-body">
                  Start from scratch and define everything yourself.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentEditor({
  detail,
  connectors,
  onClose,
  onSaved,
  onDelete,
}: {
  detail: AgentDetail;
  connectors: Connector[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: detail.agent.name,
    role: detail.agent.role,
    description: detail.agent.description ?? "",
    system_prompt: detail.agent.system_prompt ?? "",
    avatar_url: detail.agent.avatar_url ?? "",
    is_active: detail.agent.is_active,
    is_default: detail.agent.is_default,
  });
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(detail.tools.map((t) => t.connector_id))
  );
  const [memoryEnabled, setMemoryEnabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    const provided = new Map(detail.memory_scope.map((s) => [s.memory_layer, s.is_enabled]));
    for (const l of MEMORY_LAYERS) {
      map[l.key] = provided.has(l.key) ? !!provided.get(l.key) : provided.size === 0;
    }
    return map;
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const lower = search.toLowerCase();
    const filtered = connectors.filter(
      (c) =>
        !lower ||
        c.name.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        (c.description ?? "").toLowerCase().includes(lower)
    );
    const map = new Map<string, Connector[]>();
    for (const c of filtered) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [connectors, search]);

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInCategory = (cat: string) => {
    const items = grouped.find(([c]) => c === cat)?.[1] ?? [];
    setSelectedTools((prev) => {
      const next = new Set(prev);
      const allOn = items.every((c) => next.has(c.id));
      for (const c of items) {
        if (allOn) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await api("admin_agent_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: detail.agent.id, ...form }),
      });
      await api("admin_agent_tools_update", {
        method: "POST",
        body: JSON.stringify({
          agent_id: detail.agent.id,
          connector_ids: Array.from(selectedTools),
        }),
      });
      const layers = MEMORY_LAYERS.map((l) => ({
        memory_layer: l.key,
        is_enabled: !!memoryEnabled[l.key],
      }));
      await api("admin_agent_memory_update", {
        method: "POST",
        body: JSON.stringify({ agent_id: detail.agent.id, layers }),
      });
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/40 p-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Edit Agent: {form.name}</h2>
            <p className="mt-1 text-xs text-body">
              Slug: <code className="font-mono">{detail.agent.slug}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {err && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
              {err}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Description">
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="One-line summary of what this agent does"
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Personality &amp; Instructions"
              hint="What the agent reads at the start of every session. Write it like you're briefing a smart new hire."
            >
              <textarea
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                rows={8}
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 font-mono text-xs text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Avatar URL (optional)">
              <input
                type="text"
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-heading focus:border-primary/40 focus:outline-none"
              />
            </Field>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-xs text-body">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-xs text-body">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                />
                Default agent
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-heading">
                Tools ({selectedTools.size} of {connectors.length} enabled)
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tools"
                  className="rounded-md border border-border/40 bg-card/40 py-1 pl-7 pr-2 text-xs text-heading focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Leave all unchecked to give the agent access to every tool. Otherwise it only sees
              what you check.
            </p>
            <div className="space-y-3">
              {grouped.map(([cat, items]) => {
                const allOn = items.every((c) => selectedTools.has(c.id));
                return (
                  <div key={cat} className="rounded-lg border border-border/40 bg-card/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleAllInCategory(cat)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {allOn ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((c) => {
                        const on = selectedTools.has(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                              on ? "bg-primary/10 text-heading" : "text-body hover:bg-card/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleTool(c.id)}
                              className="h-3.5 w-3.5 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                            />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground">No tools match your search.</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-heading">Memory Access</p>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Pick which memory layers this agent can read at session start.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MEMORY_LAYERS.map((l) => (
                <label
                  key={l.key}
                  className={`flex items-start gap-2 rounded-md border border-border/40 p-3 text-xs transition-colors ${
                    memoryEnabled[l.key] ? "bg-primary/5" : "bg-card/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!memoryEnabled[l.key]}
                    onChange={(e) =>
                      setMemoryEnabled({ ...memoryEnabled, [l.key]: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border/40 bg-card/40 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-heading">{l.label}</p>
                    <p className="text-[10px] text-muted-foreground">{l.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 p-6">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Agent
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border/40 bg-card/40 px-4 py-2 text-sm text-body transition-colors hover:text-heading"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-heading">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export type { Agent, MemoryLayerKey };
