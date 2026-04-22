/**
 * Agent runner for TestPass.
 *
 * Picks up items left pending by the deterministic runner and evaluates
 * them using Claude Haiku. Designed for checks that require judgment
 * rather than binary pass/fail assertions (check_type: agent | hybrid).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pack, RunProfile } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateItem, createEvidence } from "../run-manager.js";

type AgentVerdict = "check" | "fail" | "na" | "other";

interface AgentOutcome {
  verdict: AgentVerdict;
  note?: string;
  reasoning: string;
}

async function fetchPendingCheckIds(
  config: RunManagerConfig,
  runId: string,
): Promise<string[]> {
  const url = `${config.supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&verdict=eq.pending&select=check_id`;
  const res = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ check_id: string }>;
  return rows.map((r) => r.check_id);
}

async function fetchProbePayload(
  config: RunManagerConfig,
  evidenceRef: string,
): Promise<unknown> {
  const url = `${config.supabaseUrl}/rest/v1/testpass_evidence?id=eq.${evidenceRef}&select=payload&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ payload: unknown }>;
  return rows[0]?.payload ?? null;
}

const SYSTEM_PROMPT = `You are a QA evaluator for MCP (Model Context Protocol) servers. You are given a check specification and probe data collected from a live server. Determine if the server passes or fails the check.

Respond with valid JSON only, no other text:
{"verdict":"check","reasoning":"one sentence"}

Verdict meanings:
- "check": server passes this requirement
- "fail": server clearly fails this requirement
- "na": check cannot be evaluated from the available data
- "other": ambiguous result requiring human review`;

async function evaluateCheck(
  client: Anthropic,
  checkId: string,
  title: string,
  description: string | undefined,
  expected: unknown,
  onFail: string | undefined,
  targetUrl: string,
  probeData: unknown,
): Promise<AgentOutcome> {
  const parts = [
    `Check ID: ${checkId}`,
    `Title: ${title}`,
    description ? `Description: ${description}` : null,
    expected ? `Expected: ${JSON.stringify(expected)}` : null,
    onFail ? `On fail guidance: ${onFail}` : null,
    `Target URL: ${targetUrl}`,
    probeData
      ? `Probe data:\n${JSON.stringify(probeData, null, 2)}`
      : "No probe data available.",
  ].filter(Boolean) as string[];

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: parts.join("\n") }],
  });

  const text = (msg.content as Array<{ type: string; text?: string }>)
    .find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text.trim()) as { verdict?: string; reasoning?: string };
    const validVerdicts: AgentVerdict[] = ["check", "fail", "na", "other"];
    const verdict: AgentVerdict = validVerdicts.includes(parsed.verdict as AgentVerdict)
      ? (parsed.verdict as AgentVerdict)
      : "other";
    return { verdict, reasoning: parsed.reasoning ?? text };
  } catch {
    return { verdict: "other", note: "Failed to parse LLM response", reasoning: text };
  }
}

/**
 * Run LLM-assisted checks for all pending items in a run.
 * Items with no matching pack spec are silently skipped.
 * Each check runs independently via Promise.allSettled.
 */
export async function runAgentChecks(
  config: RunManagerConfig,
  runId: string,
  targetUrl: string,
  pack: Pack,
  _profile: RunProfile,
  probeEvidenceRef?: string,
): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return;

  const pendingCheckIds = await fetchPendingCheckIds(config, runId);
  if (pendingCheckIds.length === 0) return;

  let probeData: unknown = null;
  if (probeEvidenceRef) {
    probeData = await fetchProbePayload(config, probeEvidenceRef);
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const packItemMap = new Map(pack.items.map((i) => [i.id, i]));

  await Promise.allSettled(
    pendingCheckIds.map(async (checkId) => {
      const spec = packItemMap.get(checkId);
      if (!spec) return;

      const checkStart = Date.now();
      let outcome: AgentOutcome;
      try {
        outcome = await evaluateCheck(
          client,
          checkId,
          spec.title,
          spec.description,
          spec.expected,
          spec.on_fail,
          targetUrl,
          probeData,
        );
      } catch (err) {
        outcome = {
          verdict: "other",
          note: `Agent runner exception: ${(err as Error).message}`,
          reasoning: "",
        };
      }

      const time_ms = Date.now() - checkStart;

      let evidenceRef: string | undefined;
      try {
        evidenceRef = await createEvidence(config, {
          kind: "agent_verdict",
          payload: {
            reasoning: outcome.reasoning,
            model: "claude-haiku-4-5",
            check_id: checkId,
          },
        });
      } catch {
        // non-fatal
      }

      await updateItem(config, runId, checkId, {
        verdict: outcome.verdict,
        on_fail_comment: outcome.note,
        time_ms,
        cost_usd: 0,
        evidence_ref: evidenceRef,
      });
    }),
  );
}
