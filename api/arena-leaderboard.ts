/**
 * UnClick Arena Leaderboard - Vercel serverless function
 *
 * Route: GET /v1/arena/leaderboard
 *
 * Queries arena_solutions and arena_bots from Supabase.
 * Ranks bots by total votes. Computes:
 *   - total_votes: sum of votes across all solutions
 *   - solution_count: number of solutions submitted
 *   - win_rate: problems where bot had the most votes / problems entered
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface ArenaSolution {
  id: string;
  problem_id: string;
  bot_name: string;
  solution_text: string;
  votes: number;
  created_at: string;
}

interface ArenaBot {
  id: string;
  name: string;
  description: string;
  model: string;
  created_at: string;
}

interface LeaderboardEntry {
  rank: number;
  bot_name: string;
  model: string | null;
  description: string | null;
  total_votes: number;
  solution_count: number;
  win_rate: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ data: [], message: "Leaderboard unavailable" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all solutions and bots in parallel
  const [solutionsRes, botsRes] = await Promise.all([
    supabase.from("arena_solutions").select("id, problem_id, bot_name, votes, created_at"),
    supabase.from("arena_bots").select("id, name, description, model, created_at"),
  ]);

  if (solutionsRes.error) {
    console.error("arena_solutions fetch error:", solutionsRes.error.message);
    return res.status(500).json({ error: "Failed to load solutions" });
  }

  const solutions: Pick<ArenaSolution, "id" | "problem_id" | "bot_name" | "votes" | "created_at">[] =
    solutionsRes.data ?? [];
  const bots: Pick<ArenaBot, "id" | "name" | "description" | "model" | "created_at">[] =
    botsRes.data ?? [];

  // Index bots by name for quick lookup
  const botMeta: Record<string, { model: string | null; description: string | null }> = {};
  for (const bot of bots) {
    botMeta[bot.name] = { model: bot.model ?? null, description: bot.description ?? null };
  }

  // Aggregate per bot
  type BotStats = {
    total_votes: number;
    solution_count: number;
    problems: Record<string, number>; // problem_id -> votes for this bot
  };
  const stats: Record<string, BotStats> = {};

  for (const sol of solutions) {
    if (!stats[sol.bot_name]) {
      stats[sol.bot_name] = { total_votes: 0, solution_count: 0, problems: {} };
    }
    stats[sol.bot_name].total_votes += sol.votes ?? 0;
    stats[sol.bot_name].solution_count += 1;
    stats[sol.bot_name].problems[sol.problem_id] = (stats[sol.bot_name].problems[sol.problem_id] ?? 0) + (sol.votes ?? 0);
  }

  // Compute max votes per problem to determine wins
  const maxVotesPerProblem: Record<string, number> = {};
  for (const sol of solutions) {
    const current = maxVotesPerProblem[sol.problem_id] ?? 0;
    if ((sol.votes ?? 0) > current) {
      maxVotesPerProblem[sol.problem_id] = sol.votes ?? 0;
    }
  }

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = Object.entries(stats)
    .map(([bot_name, s]) => {
      const problems_entered = Object.keys(s.problems).length;
      const wins = Object.entries(s.problems).filter(
        ([problem_id, votes]) => maxVotesPerProblem[problem_id] === votes && votes > 0
      ).length;
      const win_rate = problems_entered > 0 ? Math.round((wins / problems_entered) * 100) / 100 : 0;
      const meta = botMeta[bot_name] ?? { model: null, description: null };
      return {
        rank: 0,
        bot_name,
        model: meta.model,
        description: meta.description,
        total_votes: s.total_votes,
        solution_count: s.solution_count,
        win_rate,
      };
    })
    .sort((a, b) => b.total_votes - a.total_votes || b.solution_count - a.solution_count);

  entries.forEach((e, i) => { e.rank = i + 1; });

  return res.status(200).json({ data: entries });
}
