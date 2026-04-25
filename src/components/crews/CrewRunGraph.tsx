import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";

type RunStatus = "pending" | "running" | "complete" | "failed";
type AgentStatus = "idle" | "thinking" | "done" | "failed";

export interface RunAgent {
  id: string;
  name: string;
  colour_token: string;
  category: string;
  slug: string;
}

interface RunMessage {
  id: string;
  agent_id: string | null;
  role: string;
  stage: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

interface Props {
  runStatus: RunStatus;
  agents: RunAgent[];
  messages: RunMessage[];
  startedAt: string | null;
  completedAt: string | null;
}

const COLOUR_MAP: Record<string, string> = {
  "crew-exec": "#61C1C4",
  "crew-creative": "#E2B93B",
  "crew-tech": "#7FB3D5",
  "crew-think": "#C39BD3",
  "crew-domain": "#82E0AA",
  "crew-life": "#F5B7B1",
  "crew-meta": "#F7DC6F",
};

const CATEGORY_TOKEN: Record<string, string> = {
  business: "crew-exec",
  creative: "crew-creative",
  technical: "crew-tech",
  thinking: "crew-think",
  domain: "crew-domain",
  lifestyle: "crew-life",
  meta: "crew-meta",
};

function agentColour(agent: RunAgent): string {
  return (
    COLOUR_MAP[agent.colour_token] ??
    COLOUR_MAP[CATEGORY_TOKEN[agent.category] ?? ""] ??
    "#61C1C4"
  );
}

function getAgentStatus(
  agentId: string,
  runStatus: RunStatus,
  messages: RunMessage[],
  isChairman: boolean,
): AgentStatus {
  if (runStatus === "failed") return "failed";
  if (runStatus === "complete") return "done";
  const agentMsgs = messages.filter((m) => m.agent_id === agentId);
  if (agentMsgs.length > 0) return "done";
  if (isChairman) {
    const hasSynthesis = messages.some((m) => m.stage === "synthesis");
    if (hasSynthesis) return "done";
    if (runStatus === "running") {
      const allOpinions = messages.filter((m) => m.stage === "opinion");
      const advisorCount = messages.filter((m) => m.stage === "opinion" || m.stage === "peer_review").length;
      return allOpinions.length > 0 && advisorCount > 0 ? "thinking" : "idle";
    }
    return "idle";
  }
  if (runStatus === "running" || runStatus === "pending") return "thinking";
  return "idle";
}

const W = 400;
const H = 400;
const CX = W / 2;
const CY = H / 2;
const SPOKE_R = 140;
const HUB_R = 38;
const NODE_R = 26;

function spokePos(i: number, n: number) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return { x: CX + SPOKE_R * Math.cos(angle), y: CY + SPOKE_R * Math.sin(angle) };
}

interface FlowDot {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colour: string;
}

export default function CrewRunGraph({ runStatus, agents, messages, startedAt, completedAt }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [flowDots, setFlowDots] = useState<FlowDot[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevMsgCount = useRef(0);

  const chairman = agents.find((a) => a.slug === "chairman");
  const advisors = agents.filter((a) => a.slug !== "chairman");
  const n = advisors.length;

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const newMsgs = messages.slice(prevMsgCount.current);
      const newDots: FlowDot[] = [];
      newMsgs.forEach((msg) => {
        const agent = agents.find((a) => a.id === msg.agent_id);
        if (!agent) return;
        const agentIdx = advisors.findIndex((a) => a.id === agent.id);
        if (agentIdx === -1) return;
        const pos = spokePos(agentIdx, n);
        newDots.push({
          id: msg.id,
          x1: pos.x,
          y1: pos.y,
          x2: CX,
          y2: CY,
          colour: agentColour(agent),
        });
      });
      if (newDots.length > 0) {
        setFlowDots((prev) => [...prev, ...newDots]);
        setTimeout(() => {
          setFlowDots((prev) => prev.filter((d) => !newDots.some((nd) => nd.id === d.id)));
        }, 1400);
      }
      prevMsgCount.current = messages.length;
    }
  }, [messages, agents, advisors, n]);

  useEffect(() => {
    if (runStatus === "complete") {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [runStatus]);

  const opinionsCount = messages.filter((m) => m.stage === "opinion").length;
  const allCount = n;
  const totalStages = 2;
  const currentStage = messages.some((m) => m.stage === "synthesis")
    ? "done"
    : messages.some((m) => m.stage === "peer_review")
    ? 2
    : messages.some((m) => m.stage === "opinion")
    ? 2
    : 1;

  const etaSec =
    runStatus === "running" && startedAt
      ? Math.max(0, 90 - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      : null;

  const selectedAgent = agents.find((a) => a.id === selected);
  const selectedMsgs = messages.filter((m) => m.agent_id === selected);

  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="space-y-4">
      {showConfetti && <ConfettiLayer />}

      <div className="relative mx-auto max-w-sm sm:max-w-md">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          aria-label="Crew activity graph"
        >
          {advisors.map((adv, i) => {
            const pos = spokePos(i, n);
            return (
              <line
                key={adv.id}
                x1={CX}
                y1={CY}
                x2={pos.x}
                y2={pos.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1.5}
              />
            );
          })}

          {flowDots.map((dot) => (
            <circle key={dot.id} r={5} fill={dot.colour} opacity={0.9}>
              <animateMotion
                dur="1.2s"
                fill="freeze"
                path={`M ${dot.x1} ${dot.y1} L ${dot.x2} ${dot.y2}`}
              />
            </circle>
          ))}

          {chairman && (
            <HubNode
              x={CX}
              y={CY}
              r={HUB_R}
              agent={chairman}
              status={getAgentStatus(chairman.id, runStatus, messages, true)}
              isHub
              isComplete={runStatus === "complete"}
              onClick={() => setSelected((s) => (s === chairman.id ? null : chairman.id))}
              selected={selected === chairman.id}
            />
          )}

          {advisors.map((adv, i) => {
            const pos = spokePos(i, n);
            const status = getAgentStatus(adv.id, runStatus, messages, false);
            return (
              <HubNode
                key={adv.id}
                x={pos.x}
                y={pos.y}
                r={NODE_R}
                agent={adv}
                status={status}
                isHub={false}
                isComplete={false}
                onClick={() => setSelected((s) => (s === adv.id ? null : adv.id))}
                selected={selected === adv.id}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-xs text-[#666]">
        {runStatus === "complete" ? (
          <span className="text-emerald-400">All done. Verdict ready below.</span>
        ) : runStatus === "failed" ? (
          <span className="text-rose-400">Run failed.</span>
        ) : (
          <>
            <span>
              {currentStage === "done"
                ? "Finalising verdict"
                : `Round ${currentStage} of ${totalStages}`}
              {" - "}Agents complete: {opinionsCount}/{allCount}
            </span>
            {etaSec !== null && <span>ETA: ~{etaSec}s</span>}
          </>
        )}
      </div>

      {selected && selectedAgent && (
        <div
          className="rounded-xl border border-white/[0.09] bg-white/[0.03] overflow-hidden"
          style={{ borderColor: `${agentColour(selectedAgent)}33` }}
        >
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                style={{
                  backgroundColor: `${agentColour(selectedAgent)}18`,
                  color: agentColour(selectedAgent),
                }}
              >
                {selectedAgent.name.charAt(0)}
              </span>
              <span className="text-xs font-semibold text-[#ddd]">{selectedAgent.name}</span>
            </div>
            {panelOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-[#555]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[#555]" />
            )}
          </button>

          {panelOpen && (
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
              {selectedMsgs.length === 0 ? (
                <p className="text-xs text-[#555]">
                  {runStatus === "running" || runStatus === "pending"
                    ? "Working on it..."
                    : "No contribution recorded."}
                </p>
              ) : (
                selectedMsgs.map((msg) => (
                  <AgentMsgBlock key={msg.id} msg={msg} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      <MobileAgentList
        agents={agents}
        advisors={advisors}
        chairman={chairman}
        messages={messages}
        runStatus={runStatus}
        selected={selected}
        onSelect={(id) => setSelected((s) => (s === id ? null : id))}
      />
    </div>
  );
}

interface HubNodeProps {
  x: number;
  y: number;
  r: number;
  agent: RunAgent;
  status: AgentStatus;
  isHub: boolean;
  isComplete: boolean;
  onClick: () => void;
  selected: boolean;
}

function HubNode({ x, y, r, agent, status, isHub, isComplete, onClick, selected }: HubNodeProps) {
  const colour = agentColour(agent);
  const label = agent.name.charAt(0);

  const strokeColour =
    status === "done"
      ? "#4ade80"
      : status === "failed"
      ? "#f87171"
      : status === "thinking"
      ? colour
      : "rgba(255,255,255,0.10)";

  const strokeWidth = status === "thinking" ? 2.5 : 1.5;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`${agent.name} - ${status}`}
    >
      {status === "thinking" && (
        <circle cx={x} cy={y} r={r + 6} fill="none" stroke={colour} strokeWidth={1} opacity={0.3}>
          <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}
      {isComplete && isHub && (
        <circle cx={x} cy={y} r={r + 8} fill="none" stroke="#4ade80" strokeWidth={2}>
          <animate attributeName="r" values={`${r + 6};${r + 16};${r + 6}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {selected && (
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke={colour} strokeWidth={1.5} opacity={0.5} />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={`${colour}18`}
        stroke={strokeColour}
        strokeWidth={strokeWidth}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colour}
        fontSize={isHub ? 15 : 11}
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
      {status === "done" && (
        <circle cx={x + r - 6} cy={y - r + 6} r={8} fill="#111" />
      )}
      {status === "done" && (
        <path
          d={`M ${x + r - 10} ${y - r + 6} l 3 3 l 5 -5`}
          fill="none"
          stroke="#4ade80"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {status === "failed" && (
        <circle cx={x + r - 6} cy={y - r + 6} r={8} fill="#111" />
      )}
      {status === "failed" && (
        <path
          d={`M ${x + r - 9} ${y - r + 3} l 6 6 M ${x + r - 3} ${y - r + 3} l -6 6`}
          fill="none"
          stroke="#f87171"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
      <text
        x={x}
        y={y + r + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.45)"
        fontSize={8.5}
        fontFamily="system-ui, sans-serif"
      >
        {agent.name.length > 10 ? agent.name.slice(0, 9) + "..." : agent.name}
      </text>
    </g>
  );
}

function AgentMsgBlock({ msg }: { msg: RunMessage }) {
  const label =
    msg.stage === "opinion"
      ? "Opinion"
      : msg.stage === "peer_review"
      ? "Peer rankings"
      : msg.stage === "synthesis"
      ? "Synthesis"
      : msg.stage;
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">{label}</p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#bbb]">{msg.content}</p>
    </div>
  );
}

interface MobileListProps {
  agents: RunAgent[];
  advisors: RunAgent[];
  chairman: RunAgent | undefined;
  messages: RunMessage[];
  runStatus: RunStatus;
  selected: string | null;
  onSelect: (id: string) => void;
}

function MobileAgentList({ agents, advisors, chairman, messages, runStatus, selected, onSelect }: MobileListProps) {
  return (
    <div className="sm:hidden space-y-2 mt-2">
      {chairman && (
        <MobileAgentRow
          agent={chairman}
          status={getAgentStatus(chairman.id, runStatus, messages, true)}
          isHub
          selected={selected === chairman.id}
          onSelect={onSelect}
        />
      )}
      {advisors.map((adv) => (
        <MobileAgentRow
          key={adv.id}
          agent={adv}
          status={getAgentStatus(adv.id, runStatus, messages, false)}
          isHub={false}
          selected={selected === adv.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function MobileAgentRow({
  agent,
  status,
  isHub,
  selected,
  onSelect,
}: {
  agent: RunAgent;
  status: AgentStatus;
  isHub: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const colour = agentColour(agent);
  const statusLabel =
    status === "done" ? "Done" : status === "thinking" ? "Thinking..." : status === "failed" ? "Failed" : "Waiting";
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        selected ? "border-white/[0.12] bg-white/[0.05]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
        style={{ backgroundColor: `${colour}18`, color: colour }}
      >
        {agent.name.charAt(0)}
      </span>
      <span className="flex-1 text-xs font-medium text-[#ddd]">
        {agent.name} {isHub && <span className="ml-1 text-[10px] text-[#555]">(Chairman)</span>}
      </span>
      <span
        className={`text-[10px] font-semibold ${
          status === "done"
            ? "text-emerald-400"
            : status === "thinking"
            ? "text-blue-400"
            : status === "failed"
            ? "text-rose-400"
            : "text-[#555]"
        }`}
      >
        {statusLabel}
      </span>
    </button>
  );
}

const CONFETTI_COLOURS = ["#61C1C4", "#E2B93B", "#C39BD3", "#82E0AA", "#F5B7B1", "#7FB3D5"];

function ConfettiLayer() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((i) => {
        const colour = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
        const left = `${5 + (i * 3.8) % 90}%`;
        const delay = `${(i * 0.12) % 1.2}s`;
        const size = 6 + (i % 5) * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "-10px",
              left,
              width: size,
              height: size,
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              backgroundColor: colour,
              animationName: "confettiFall",
              animationDuration: `${2.5 + (i % 6) * 0.3}s`,
              animationDelay: delay,
              animationTimingFunction: "linear",
              animationFillMode: "forwards",
              transform: `rotate(${i * 37}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
