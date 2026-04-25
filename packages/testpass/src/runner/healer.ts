/**
 * Healer retry for TestPass.
 *
 * Re-runs failed deterministic checks through a caller supplied sampler to
 * catch transient infrastructure hiccups (flaky networks, cold starts, rate
 * limits) that caused a binary check to fail the first time around. The
 * server never calls Anthropic directly; evaluation flows through MCP
 * sampling.
 *
 * Returns the number of items whose verdict changed as a result of healing.
 */

import type { Pack } from "../types.js";
import type { RunManagerConfig } from "../run-manager.js";
import { updateItem, createEvidence } from "../run-manager.js";
import type { JudgeSampler } from "./agent.js";

interface FailedItem {
  check_id: string;
  check_type?: string;
}

const SYSTEM_PROMPT = `You are a QA healer for MCP (Model Context Protocol) servers. A deterministic probe previously marked this check as failed. Re-evaluate the check based on the latest server behaviour described in the probe data and decide whether it now passes.

Respond with valid JSON only, no other text:
{"verdict":"check","reasoning":"one sentence"}

Verdict meanings:
- "check": server now passes this requirement
- "fail": server still fails this requirement
- "na": check cannot be evaluated
- "other": ambiguous result requiring human review`;

async function fetchFailedDeterministicIds(
  config: RunManagerConfig,
  runId: string,
): Promise<string[]> {
  const url = `${config.supabaseUrl}/rest/v1/testpass_items?run_id=eq.${runId}&verdict=eq.fail&select=check_id`;
  const res = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as FailedItem[];
  return rows.map((r) => r.check_id);
}

export async function healFailedChecks(
  config: RunManagerConfig,
  runId: string,
  pack: Pack,
  sampler?: JudgeSampler,
): Promise<number> {
  if (!sampler) return 0;

  const failedIds = await fetchFailedDeterministicIds(config, runId);
  if (failedIds.length === 0) return 0;

  const packItemMap = new Map(pack.items.map((i) => [i.id, i]));

  let healedCount = 0;

  await Promise.allSettled(
    failedIds.map(async (checkId) => {
      const spec = packItemMap.get(checkId);
      if (!spec || spec.check_type !== "deterministic") return;

      const parts = [
        `Check ID: ${checkId}`,
        `Title: ${spec.title}`,
        spec.description ? `Description: ${spec.description}` : null,
        spec.expected ? `Expected: ${JSON.stringify(spec.expected)}` : null,
        spec.on_fail ? `On fail guidance: ${spec.on_fail}` : null,
      ].filter(Boolean) as string[];

      type HealedVerdict = "check" | "fail" | "na" | "other";
      let reasoning = "";
      let newVerdict: HealedVerdict = "other";
      let model = "unknown";

      try {
        const r = await sampler({
          system: SYSTEM_PROMPT,
          user: parts.join("\n"),
          maxTokens: 256,
        });
        model = r.model;
        const parsed = JSON.parse(r.text.trim()) as { verdict?: string; reasoning?: string };
        const valid: readonly HealedVerdict[] = ["check", "fail", "na", "other"];
        if ((valid as readonly string[]).includes(parsed.verdict ?? "")) {
          newVerdict = parsed.verdict as HealedVerdict;
        }
        reasoning = parsed.reasoning ?? r.text;
      } catch (err) {
        reasoning = `Healer exception: ${(err as Error).message}`;
        return;
      }

      if (newVerdict === "fail") return;

      let evidenceRef: string | undefined;
      try {
        evidenceRef = await createEvidence(config, {
          kind: "log",
          payload: {
            healer: true,
            reasoning,
            model,
            check_id: checkId,
            new_verdict: newVerdict,
          },
        });
      } catch {
        // non-fatal
      }

      await updateItem(config, runId, checkId, {
        verdict: newVerdict,
        on_fail_comment: `healed: ${reasoning}`,
        evidence_ref: evidenceRef,
      });
      healedCount++;
    }),
  );

  return healedCount;
}