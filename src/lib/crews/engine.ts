import { createClient } from "@supabase/supabase-js";

const MAX_PER_CALL = 2048;
const LABELS = "ABCDEFGHIJKLMNOP".split("");

export interface SamplerResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Sampler callback: the engine hands off every LLM prompt to the calling
 * Orchestrator via MCP's `sampling/createMessage` capability. The MCP client
 * (Claude Desktop, etc.) runs the model and returns the response. The server
 * never calls Anthropic directly for user-facing runs.
 */
export type Sampler = (args: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<SamplerResult>;

export interface SamplingNotSupportedError {
  error: "SAMPLING_NOT_SUPPORTED";
  message: string;
}

export interface EngineCtx {
  runId: string;
  crewId: string;
  apiKeyHash: string;
  taskPrompt: string;
  tokenBudget: number;
  supabaseUrl: string;
  serviceRoleKey: string;
  /** MCP sampler bound to the calling Orchestrator. Required for user-facing runs. */
  sampler?: Sampler;
  /** Explicit capability flag from MCP `initialize`. When false the engine aborts. */
  supportsSampling?: boolean;
}

interface AgentRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  seed_prompt: string | null;
}

interface StageResult {
  agentId: string;
  label: string;
  name: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
}

export async function runCouncilEngine(ctx: EngineCtx): Promise<void> {
  const { runId, crewId, apiKeyHash, taskPrompt, tokenBudget } = ctx;
  const sb = createClient(ctx.supabaseUrl, ctx.serviceRoleKey);
  let tokensUsed = 0;

  async function updateRun(patch: Record<string, unknown>) {
    await sb
      .from("mc_crew_runs")
      .update(patch)
      .eq("id", runId)
      .eq("api_key_hash", apiKeyHash);
  }

  async function writeMsg(
    agentId: string | null,
    role: string,
    stage: string,
    content: string,
    tokensIn: number,
    tokensOut: number,
  ) {
    tokensUsed += tokensIn + tokensOut;
    await sb.from("mc_run_messages").insert({
      api_key_hash: apiKeyHash,
      run_id: runId,
      agent_id: agentId,
      role,
      stage,
      content,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    });
  }

  // Capability gate: fail fast if the caller cannot do MCP sampling.
  if (ctx.supportsSampling === false || !ctx.sampler) {
    const err: SamplingNotSupportedError = {
      error: "SAMPLING_NOT_SUPPORTED",
      message:
        "Orchestrator does not support sampling. Use Claude Desktop or another sampling-capable client.",
    };
    await updateRun({
      status: "failed",
      completed_at: new Date().toISOString(),
      tokens_used: 0,
      result_artifact: err,
    }).catch(() => null);
    throw Object.assign(new Error(err.message), err);
  }

  const sampler = ctx.sampler;

  async function callSampler(system: string, user: string): Promise<SamplerResult> {
    if (tokensUsed >= tokenBudget) {
      throw Object.assign(new Error("token_budget_exceeded"), { isBudget: true });
    }
    return sampler({ system, user, maxTokens: MAX_PER_CALL });
  }

  try {
    await updateRun({ status: "running", started_at: new Date().toISOString() });

    // Load crew (api_key_hash filter is mandatory - service_role bypasses RLS)
    const { data: crew } = await sb
      .from("mc_crews")
      .select("agent_ids")
      .eq("id", crewId)
      .eq("api_key_hash", apiKeyHash)
      .single();
    if (!crew) throw new Error("Crew not found");

    const agentIds: string[] = (crew as { agent_ids: string[] }).agent_ids ?? [];
    const { data: rawAgents } = await sb
      .from("mc_agents")
      .select("id,slug,name,category,seed_prompt")
      .in("id", agentIds);
    const agents: AgentRow[] = (rawAgents ?? []) as AgentRow[];

    const advisors = agents.filter((a) => a.category !== "meta");
    let chairman: AgentRow | null = agents.find((a) => a.slug === "chairman") ?? null;

    // Auto-add system chairman if not in crew
    if (!chairman) {
      const { data: sys } = await sb
        .from("mc_agents")
        .select("id,slug,name,category,seed_prompt")
        .eq("slug", "chairman")
        .eq("is_system", true)
        .maybeSingle();
      chairman = (sys as AgentRow | null) ?? null;
    }

    // Pre-run: load relevant facts from UnClick Memory (search_memory equivalent)
    const { data: factRows } = await sb
      .from("mc_extracted_facts")
      .select("fact")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    const words = taskPrompt.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const matched = ((factRows ?? []) as { fact: string }[])
      .filter((f) => words.some((w) => f.fact.toLowerCase().includes(w)))
      .slice(0, 5);

    const memCtx = matched.length > 0
      ? `Relevant context from your memory:\n${matched.map((f) => `- ${f.fact}`).join("\n")}\n\n`
      : "";

    // Stage 1: Fan-out - each advisor gives their opinion in parallel
    const stage1: StageResult[] = await Promise.all(
      advisors.map(async (agent, i) => {
        const system = `${agent.seed_prompt ?? `You are ${agent.name}.`}\n\nProvide your honest, specific opinion on the task. 150 to 250 words. Be direct and substantive.`;
        const user = `${memCtx}Task: ${taskPrompt}`;
        const { content, tokensIn, tokensOut } = await callSampler(system, user);
        return {
          agentId: agent.id,
          label: `Opinion ${LABELS[i] ?? String(i + 1)}`,
          name: agent.name,
          content,
          tokensIn,
          tokensOut,
        };
      })
    );

    for (const r of stage1) {
      await writeMsg(r.agentId, "advisor", "opinion", r.content, r.tokensIn, r.tokensOut);
    }
    await updateRun({ tokens_used: tokensUsed });

    // Stage 2: Peer review - each advisor ranks the others' opinions in parallel
    await Promise.all(
      stage1.map(async (reviewer) => {
        const others = stage1.filter((o) => o.agentId !== reviewer.agentId);
        const othersText = others.map((o) => `${o.label}:\n${o.content}`).join("\n\n---\n\n");
        const agent = advisors.find((a) => a.id === reviewer.agentId)!;
        const system = `${agent.seed_prompt ?? `You are ${agent.name}.`}\n\nRank each opinion below from 1 (most compelling) to ${others.length} (least). One-line rationale per ranking. Be honest and concise.`;
        const user = `Task: ${taskPrompt}\n\nOpinions to rank:\n\n${othersText}`;
        const { content, tokensIn, tokensOut } = await callSampler(system, user);
        await writeMsg(reviewer.agentId, "advisor", "peer_review", content, tokensIn, tokensOut);
      })
    );
    await updateRun({ tokens_used: tokensUsed });

    // Stage 3: Chairman synthesises all opinions into a final answer
    if (chairman) {
      const opinionsText = stage1
        .map((o) => `${o.label} (${o.name}):\n${o.content}`)
        .join("\n\n---\n\n");
      const system = `You are the Chairman. Synthesise all advisor opinions into one clear, final answer.\n\nFormat your response exactly as:\n\nFINAL ANSWER:\n[Your conclusion, 200 to 350 words]\n\nWHAT DIDN'T MAKE THE CONSENSUS:\n[Minority views not incorporated, 1 to 3 bullet points starting with -. If full consensus, write: No significant dissents.]`;
      const user = `Task: ${taskPrompt}\n\nAdvisor opinions:\n\n${opinionsText}`;
      const { content, tokensIn, tokensOut } = await callSampler(system, user);
      await writeMsg(chairman.id, "chairman", "synthesis", content, tokensIn, tokensOut);
    }

    await updateRun({
      status: "complete",
      completed_at: new Date().toISOString(),
      tokens_used: tokensUsed,
    });
  } catch (err: unknown) {
    const isBudget = (err as { isBudget?: boolean }).isBudget === true;
    await updateRun({
      status: "failed",
      completed_at: new Date().toISOString(),
      tokens_used: tokensUsed,
      result_artifact: {
        error: isBudget
          ? "token_budget_exceeded"
          : ((err as Error).message ?? "Engine error"),
      },
    }).catch(() => null);
  }
}