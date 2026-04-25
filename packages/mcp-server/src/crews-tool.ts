/**
 * crews-tool - MCP handlers for the Crews Council Orchestrator Wizard.
 *
 * All three tools return a ConversationalCard so the calling agent can surface
 * status in plain prose without parsing raw run JSON. LLM traffic for user
 * facing runs flows via MCP sampling, not via server side Anthropic calls.
 */

import { buildCard, type ConversationalCard } from "./cards/card.js";

const API_BASE = (process.env.UNCLICK_API_URL ?? "https://unclick.world").replace(/\/$/, "");

function getApiKey(): string {
  const key = process.env.UNCLICK_API_KEY?.trim();
  if (!key) {
    throw new Error("UNCLICK_API_KEY env var is not set. Get your install config at https://unclick.world");
  }
  return key;
}

async function adminCall(
  action: string,
  body: Record<string, unknown> | null,
  method: "GET" | "POST",
  query?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const apiKey = getApiKey();
  const qs = new URLSearchParams({ action, ...(query ?? {}) }).toString();
  const url = `${API_BASE}/api/memory-admin?${qs}`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
  if (method === "POST" && body) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = text;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, json };
}

type AdminCard = { card?: ConversationalCard; error?: string; message?: string; run_id?: string };

export async function crewsStartRun(args: Record<string, unknown>): Promise<ConversationalCard> {
  const crewId = String(args.crew_id ?? "").trim();
  const taskPrompt = String(args.task_prompt ?? "").trim();
  const tokenBudget = typeof args.token_budget === "number" ? args.token_budget : undefined;
  if (!crewId) {
    return buildCard({
      headline: "start_crew_run needs a crew_id",
      summary: "Provide the UUID of the Crew to run.",
      keyFacts: ["missing: crew_id"],
      nextActions: ["Call list_runs or browse /admin/crews to find a crew_id"],
    });
  }
  if (!taskPrompt) {
    return buildCard({
      headline: "start_crew_run needs a task_prompt",
      summary: "Describe what you want the Council to deliberate on.",
      keyFacts: ["missing: task_prompt"],
      nextActions: ["Retry with a task_prompt of at least one sentence"],
    });
  }
  const body: Record<string, unknown> = { crew_id: crewId, task_prompt: taskPrompt };
  if (tokenBudget) body.token_budget = tokenBudget;
  const { ok, status, json } = await adminCall("start_crew_run", body, "POST");
  const payload = (json ?? {}) as AdminCard;
  if (payload.card) return payload.card;
  if (!ok) {
    return buildCard({
      headline: `start_crew_run failed (HTTP ${status})`,
      summary: payload.message ?? "The admin API rejected the request.",
      keyFacts: [
        `http_status: ${status}`,
        ...(payload.error ? [`error: ${payload.error}`] : []),
      ],
      nextActions: ["Check Vercel logs", "Confirm your UNCLICK_API_KEY is valid"],
    });
  }
  return buildCard({
    headline: "Crews run accepted",
    summary: "The run row was created. Poll get_run to follow progress.",
    keyFacts: payload.run_id ? [`run_id: ${payload.run_id}`] : [],
    nextActions: ["Call get_run with the run_id to check status"],
    deepLink: payload.run_id ? `/admin/crews/runs/${payload.run_id}` : undefined,
  });
}

export async function crewsGetRun(args: Record<string, unknown>): Promise<ConversationalCard> {
  const runId = String(args.run_id ?? "").trim();
  if (!runId) {
    return buildCard({
      headline: "get_run needs a run_id",
      summary: "Provide the run_id returned by start_crew_run.",
      keyFacts: ["missing: run_id"],
      nextActions: ["Call list_runs to find recent run ids"],
    });
  }
  const { ok, status, json } = await adminCall(
    "get_run",
    null,
    "GET",
    { run_id: runId },
  );
  const payload = (json ?? {}) as AdminCard;
  if (payload.card) return payload.card;
  return buildCard({
    headline: `get_run failed (HTTP ${status})`,
    summary: payload.message ?? (ok ? "No card returned." : "Admin API rejected the request."),
    keyFacts: [`http_status: ${status}`, `run_id: ${runId}`],
    nextActions: ["Verify the run_id belongs to your API key", "Check Vercel logs"],
  });
}

export async function crewsListRuns(args: Record<string, unknown>): Promise<ConversationalCard> {
  const crewId = args.crew_id ? String(args.crew_id).trim() : undefined;
  const limit = typeof args.limit === "number" ? String(args.limit) : undefined;
  const query: Record<string, string> = {};
  if (crewId) query.crew_id = crewId;
  if (limit) query.limit = limit;
  const { ok, status, json } = await adminCall("list_runs", null, "GET", query);
  const payload = (json ?? {}) as AdminCard;
  if (payload.card) return payload.card;
  return buildCard({
    headline: `list_runs failed (HTTP ${status})`,
    summary: payload.message ?? (ok ? "No card returned." : "Admin API rejected the request."),
    keyFacts: [`http_status: ${status}`],
    nextActions: ["Check Vercel logs", "Confirm your UNCLICK_API_KEY is valid"],
  });
}