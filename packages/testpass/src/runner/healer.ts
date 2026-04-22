/**
 * Healer retry for TestPass.
 *
 * Picks up deterministic-check failures from a completed run and asks the
 * agent runner to take a second look. This catches cases where a target
 * server is correct per the spec but the deterministic assertion was
 * overly strict, or where a transient error tripped the first pass.
 *
 * Only deterministic check_type items are eligible; agent and hybrid
 * items already got their judgment call on the first pass.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pack } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateItem, createEvidence } from "../run-manager.js";

type AgentVerdict = "check" | "fail" | "na" | "other";

interface FailingItem {
  check_id: string;
  evidence_ref: string | null;
}

const SYSTEM_PROMPT = `You are a QA healer for MCP (Model Context Protocol) servers. A deterministic check already flagged this target as failing. Review the check spec and any recorded evidence to decide whether the fail is genuine or whether the first pass was too strict or hit a transient error.

Respond with valid JSON only, no other text:
{"verdict":"check","reasoning":"one sentence"}

Verdict meanings:
- "check": on review the target actually passes this requirement
- "fail": the failure stands
- "na": the check cannot be evaluated from the available data
- "other": ambiguous, flag for human review`;

async function fetchFailedItems(
  config: RunManagerConfig,
  runId: string,
): Promise<FailingItem[]> {
  const url = `${config.supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&verdict=eq.fail&select=check_id,evidence_ref`;
  const res = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!res.ok) return [];
  return (await res.json()) as FailingItem[];
}

async function fetchEvidencePayload(
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

function parseVerdict(text: string): { verdict: AgentVerdict; reasoning: string } {
  const valid: AgentVerdict[] = ["check", "fail", "na", "other"];
  try {
    const parsed = JSON.parse(text.trim()) as { verdict?: string; reasoning?: string };
    const verdict: AgentVerdict = valid.includes(parsed.verdict as AgentVerdict)
      ? (parsed.verdict as AgentVerdict)
      : "other";
    return { verdict, reasoning: parsed.reasoning ?? text };
  } catch {
    return { verdict: "other", reasoning: text };
  }
}

/**
 * Re-evaluate every deterministic failure in this run using the agent model.
 * Returns the count of items whose verdict changed away from "fail".
 */
export async function healFailedChecks(
  config: RunManagerConfig,
  runId: string,
  pack: Pack,
): Promise<number> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return 0;

  const failing = await fetchFailedItems(config, runId);
  if (failing.length === 0) return 0;

  const packItemMap = new Map(pack.items.map((i) => [i.id, i]));
  const client = new Anthropic({ apiKey: anthropicKey });

  let healed = 0;

  await Promise.allSettled(
    failing.map(async (item) => {
      const spec = packItemMap.get(item.check_id);
      if (!spec || spec.check_type !== "deterministic") return;

      const evidence = item.evidence_ref
        ? await fetchEvidencePayload(config, item.evidence_ref)
        : null;

      const parts = [
        `Check ID: ${item.check_id}`,
        `Title: ${spec.title}`,
        spec.description ? `Description: ${spec.description}` : null,
        spec.expected ? `Expected: ${JSON.stringify(spec.expected)}` : null,
        spec.on_fail ? `On fail guidance: ${spec.on_fail}` : null,
        evidence
          ? `Recorded evidence from the failing deterministic run:\n${JSON.stringify(evidence, null, 2)}`
          : "No evidence was captured on the original run.",
      ].filter(Boolean) as string[];

      const start = Date.now();
      let verdict: AgentVerdict = "fail";
      let reasoning = "";
      try {
        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 256,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: parts.join("\n") }],
        });
        const text = (msg.content as Array<{ type: string; text?: string }>)
          .find((b) => b.type === "text")?.text ?? "";
        const parsed = parseVerdict(text);
        verdict = parsed.verdict;
        reasoning = parsed.reasoning;
      } catch (err) {
        reasoning = `Healer exception: ${(err as Error).message}`;
        return;
      }

      if (verdict === "fail") return;

      let evidenceRef: string | undefined;
      try {
        evidenceRef = await createEvidence(config, {
          kind: "agent_verdict",
          payload: {
            reasoning,
            model: "claude-haiku-4-5",
            check_id: item.check_id,
            healer: true,
          },
        });
      } catch {
        // non-fatal
      }

      await updateItem(config, runId, item.check_id, {
        verdict,
        on_fail_comment: `healed: ${reasoning}`,
        time_ms: Date.now() - start,
        cost_usd: 0,
        evidence_ref: evidenceRef,
      });

      healed++;
    }),
  );

  return healed;
}
