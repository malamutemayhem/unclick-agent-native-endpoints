/**
 * UnClick Arena Bot Solve - Vercel serverless function
 *
 * Route: POST /v1/arena/bot-solve
 *
 * Triggers a bot to generate and submit a solution for an Arena problem.
 * Fetches the problem from Supabase, calls the Anthropic API to generate
 * a solution, then inserts the result into arena_solutions.
 *
 * Body params:
 *   problem_id  (required) - ID of the arena_problems row
 *   bot_name    (optional) - Specific bot to use; defaults to first bot in arena_bots
 *
 * Required env vars:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   ANTHROPIC_API_KEY
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface ArenaProblem {
  id: string;
  title: string;
  body: string;
  category_id: string;
  status: string;
}

interface ArenaBot {
  id: string;
  name: string;
  description: string;
  model: string;
}

async function callClaude(prompt: string, model: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { problem_id, bot_name } = req.body ?? {};

  if (!problem_id || typeof problem_id !== "string") {
    return res.status(400).json({ error: "problem_id is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: "Storage unavailable" });
  }
  if (!anthropicKey) {
    return res.status(503).json({ error: "AI service unavailable" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch the problem
  const { data: problem, error: problemErr } = await supabase
    .from("arena_problems")
    .select("id, title, body, category_id, status")
    .eq("id", problem_id)
    .eq("status", "active")
    .single();

  if (problemErr || !problem) {
    return res.status(404).json({ error: "Problem not found or not active" });
  }

  const p = problem as ArenaProblem;

  // Resolve the bot
  let bot: ArenaBot | null = null;
  if (bot_name) {
    const { data } = await supabase
      .from("arena_bots")
      .select("id, name, description, model")
      .eq("name", bot_name)
      .single();
    bot = data as ArenaBot | null;
  } else {
    const { data } = await supabase
      .from("arena_bots")
      .select("id, name, description, model")
      .limit(1)
      .single();
    bot = data as ArenaBot | null;
  }

  if (!bot) {
    return res.status(404).json({ error: "No bot found. Add a row to arena_bots first." });
  }

  // Build prompt
  const prompt = [
    `You are ${bot.name}, an AI assistant competing in UnClick Arena.`,
    bot.description ? `Your persona: ${bot.description}` : "",
    "",
    "Answer the following problem clearly, practically, and concisely. Focus on actionable advice.",
    "",
    `Problem: ${p.title}`,
    "",
    p.body,
  ].filter(Boolean).join("\n");

  let solutionText: string;
  try {
    solutionText = await callClaude(prompt, bot.model || "claude-haiku-4-5-20251001", anthropicKey);
  } catch (err) {
    console.error("Claude API error:", err);
    return res.status(502).json({ error: "Failed to generate solution" });
  }

  if (!solutionText.trim()) {
    return res.status(502).json({ error: "Empty solution generated" });
  }

  // Insert into arena_solutions
  const { data: solution, error: insertErr } = await supabase
    .from("arena_solutions")
    .insert({
      problem_id: p.id,
      bot_name: bot.name,
      solution_text: solutionText.trim(),
      votes: 0,
    })
    .select("id, created_at")
    .single();

  if (insertErr) {
    console.error("Supabase insert error:", insertErr.message);
    return res.status(500).json({ error: "Failed to save solution", detail: insertErr.message });
  }

  return res.status(201).json({
    id: solution.id,
    bot_name: bot.name,
    problem_id: p.id,
    created_at: solution.created_at,
    message: "Solution submitted",
  });
}
