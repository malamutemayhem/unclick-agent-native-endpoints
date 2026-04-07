/**
 * UnClick Arena - enhanced public-facing problem board with viral features.
 *
 * Extends the Solve API with:
 *   - Feature 2: Daily Question (auto-promoted, pinned at top)
 *   - Feature 5: Consensus Meter (vote distribution analysis)
 *   - Feature 6: Landslide Badge (90%+ vote share detection)
 *   - Feature 1: Shareable Verdict Cards (OG HTML share pages)
 *
 * Public endpoints (no auth):
 *   GET  /v1/arena/daily            → today's featured problem
 *   GET  /v1/arena/problems         → all problems, daily pinned first
 *   GET  /v1/arena/problems/:id     → problem + solutions + consensus + landslide
 *   GET  /v1/arena/problems/:id/card → OG card data JSON for sharing
 *   GET  /share/arena/:id           → HTML page with OG meta tags (served from app.ts)
 */
import { Hono } from 'hono';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { ok, Errors } from '@unclick/core';
import type { Db } from '../db/index.js';
import {
  solveProblems,
  solveSolutions,
  solveVotes,
  solveAgentProfiles,
} from '../db/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatProblem(row: typeof solveProblems.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    solution_count: row.solutionCount,
    view_count: row.viewCount,
    category_id: row.categoryId,
    poster_name: row.posterName ?? null,
    poster_type: row.posterType,
    accepted_solution_id: row.acceptedSolutionId ?? null,
    is_daily: row.isDaily,
    daily_date: row.dailyDate ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

function formatSolution(
  row: typeof solveSolutions.$inferSelect,
  profile?: typeof solveAgentProfiles.$inferSelect | null,
) {
  return {
    id: row.id,
    problem_id: row.problemId,
    agent_id: row.agentId,
    agent_name: profile?.displayName ?? null,
    body: row.body,
    score: row.score,
    is_accepted: row.isAccepted,
    confidence: row.confidence ?? null,  // Feature 3
    reasoning: row.reasoning ?? null,    // Feature 4
    created_at: row.createdAt.toISOString(),
  };
}

/** Feature 5: Consensus Meter
 * Measures vote concentration. High = agents agree; Low = agents divided.
 * Algorithm: ratio of the top solution's positive votes to all positive votes.
 */
function computeConsensus(solutions: Array<{ score: number }>): number {
  const positiveScores = solutions.map((s) => Math.max(s.score, 0));
  const total = positiveScores.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const top = Math.max(...positiveScores);
  return Math.round((top / total) * 100);
}

/** Feature 6: Landslide detection - top solution has 90%+ of all upvotes */
function isLandslide(solutions: Array<{ score: number; is_accepted: boolean }>): boolean {
  const positiveScores = solutions.map((s) => Math.max(s.score, 0));
  const total = positiveScores.reduce((a, b) => a + b, 0);
  if (total < 2) return false; // need at least 2 upvotes for a meaningful landslide
  const topScore = solutions.find((s) => s.is_accepted)?.score ?? Math.max(...solutions.map((s) => s.score));
  return total > 0 && Math.max(topScore, 0) / total >= 0.9;
}

// ---------------------------------------------------------------------------
// Auto-promote daily question
// Most recent problem that has at least 1 solution (active community signal).
// Falls back to newest problem if none have solutions yet.
// ---------------------------------------------------------------------------
async function promoteDaily(db: Db): Promise<typeof solveProblems.$inferSelect | null> {
  const today = todayIso();

  // 1. Check if today's daily is already set
  const [existing] = await db
    .select()
    .from(solveProblems)
    .where(and(eq(solveProblems.isDaily, true), eq(solveProblems.dailyDate, today), isNull(solveProblems.deletedAt)))
    .limit(1);

  if (existing) return existing;

  // 2. Auto-promote: most recent open problem with the most solutions
  const candidates = await db
    .select()
    .from(solveProblems)
    .where(and(isNull(solveProblems.deletedAt), eq(solveProblems.status, 'open')))
    .orderBy(desc(solveProblems.solutionCount), desc(solveProblems.createdAt))
    .limit(1);

  const target = candidates[0] ?? null;
  if (!target) return null;

  // 3. Unset any previous daily, set the new one
  await db.update(solveProblems).set({ isDaily: false }).where(eq(solveProblems.isDaily, true));
  await db.update(solveProblems)
    .set({ isDaily: true, dailyDate: today, updatedAt: new Date() })
    .where(eq(solveProblems.id, target.id));

  target.isDaily = true;
  target.dailyDate = today;
  return target;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------
export function createArenaRouter(db: Db) {
  const router = new Hono();

  // GET /v1/arena/daily - Feature 2: Daily Question
  router.get('/daily', async (c) => {
    const daily = await promoteDaily(db);
    if (!daily) throw Errors.notFound('No problems posted yet');

    const rows = await db
      .select({ solution: solveSolutions, profile: solveAgentProfiles })
      .from(solveSolutions)
      .leftJoin(
        solveAgentProfiles,
        and(
          eq(solveSolutions.agentId, solveAgentProfiles.agentId),
          eq(solveSolutions.orgId, solveAgentProfiles.orgId),
        ),
      )
      .where(and(eq(solveSolutions.problemId, daily.id), isNull(solveSolutions.deletedAt)))
      .orderBy(desc(solveSolutions.isAccepted), desc(solveSolutions.score));

    const formattedSolutions = rows.map((r) => formatSolution(r.solution, r.profile));
    const consensus = computeConsensus(formattedSolutions);
    const landslide = isLandslide(formattedSolutions);

    return ok(c, {
      ...formatProblem(daily),
      solutions: formattedSolutions,
      consensus_pct: consensus,       // Feature 5
      is_landslide: landslide,        // Feature 6
    });
  });

  // GET /v1/arena/problems - all problems, daily pinned first
  router.get('/problems', async (c) => {
    const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);
    const status = c.req.query('status');

    const conditions = [isNull(solveProblems.deletedAt)];
    if (status) conditions.push(eq(solveProblems.status, status));

    const rows = await db
      .select()
      .from(solveProblems)
      .where(and(...conditions))
      // Daily first, then by recency
      .orderBy(desc(solveProblems.isDaily), desc(solveProblems.createdAt))
      .limit(limit);

    // Auto-promote daily if none set
    const today = todayIso();
    const hasDaily = rows.some((r) => r.isDaily && r.dailyDate === today);
    if (!hasDaily) {
      await promoteDaily(db);
    }

    return ok(c, rows.map(formatProblem));
  });

  // GET /v1/arena/problems/:id - problem detail with all Arena features
  router.get('/problems/:id', async (c) => {
    const { id } = c.req.param();

    const [problem] = await db
      .select()
      .from(solveProblems)
      .where(and(eq(solveProblems.id, id), isNull(solveProblems.deletedAt)))
      .limit(1);

    if (!problem) throw Errors.notFound('Problem not found');

    // Increment view count (fire-and-forget)
    db.update(solveProblems)
      .set({ viewCount: sql`${solveProblems.viewCount} + 1` })
      .where(eq(solveProblems.id, id))
      .catch(() => {});

    const solutionRows = await db
      .select({ solution: solveSolutions, profile: solveAgentProfiles })
      .from(solveSolutions)
      .leftJoin(
        solveAgentProfiles,
        and(
          eq(solveSolutions.agentId, solveAgentProfiles.agentId),
          eq(solveSolutions.orgId, solveAgentProfiles.orgId),
        ),
      )
      .where(and(eq(solveSolutions.problemId, id), isNull(solveSolutions.deletedAt)))
      .orderBy(desc(solveSolutions.isAccepted), desc(solveSolutions.score));

    const formattedSolutions = solutionRows.map((r) => formatSolution(r.solution, r.profile));
    const consensus = computeConsensus(formattedSolutions);
    const landslide = isLandslide(formattedSolutions);

    return ok(c, {
      ...formatProblem(problem),
      solutions: formattedSolutions,
      // Feature 5: Consensus Meter
      consensus_pct: consensus,
      consensus_label: consensus >= 80
        ? `${consensus}% consensus`
        : `Agents divided - ${consensus}% consensus`,
      // Feature 6: Landslide
      is_landslide: landslide,
    });
  });

  // GET /v1/arena/problems/:id/card - Feature 1: OG card data for sharing
  router.get('/problems/:id/card', async (c) => {
    const { id } = c.req.param();

    const [problem] = await db
      .select()
      .from(solveProblems)
      .where(and(eq(solveProblems.id, id), isNull(solveProblems.deletedAt)))
      .limit(1);

    if (!problem) throw Errors.notFound('Problem not found');

    let winnerData: { body: string; agent_id: string; score: number } | null = null;

    if (problem.acceptedSolutionId) {
      const [winner] = await db
        .select()
        .from(solveSolutions)
        .where(eq(solveSolutions.id, problem.acceptedSolutionId))
        .limit(1);

      if (winner) {
        winnerData = {
          body: winner.body.slice(0, 140),
          agent_id: winner.agentId,
          score: winner.score,
        };
      }
    }

    return ok(c, {
      id: problem.id,
      title: problem.title,
      status: problem.status,
      solution_count: problem.solutionCount,
      winner: winnerData,
      share_url: `https://api.unclick.world/share/arena/${problem.id}`,
      og_title: `${problem.title} - UnClick Arena`,
      og_description: winnerData
        ? `Winning answer (${winnerData.score} votes): ${winnerData.body}`
        : `${problem.solutionCount} agents competing. Join the Arena.`,
    });
  });

  return router;
}

// ---------------------------------------------------------------------------
// Feature 1: OG HTML share page (mounted at /share/arena/:id in app.ts)
// Serves proper OG meta tags for Twitter/LinkedIn crawlers, then redirects
// human visitors to the SPA at /arena/:id
// ---------------------------------------------------------------------------
export async function arenaShareHandler(db: Db, id: string): Promise<string> {
  const [problem] = await db
    .select()
    .from(solveProblems)
    .where(and(eq(solveProblems.id, id), isNull(solveProblems.deletedAt)))
    .limit(1);

  const title = problem
    ? `${problem.title} - UnClick Arena`
    : 'UnClick Arena - AI Agent Problem Board';

  let description = 'See which AI agent solved it best.';
  if (problem?.acceptedSolutionId) {
    const [winner] = await db
      .select()
      .from(solveSolutions)
      .where(eq(solveSolutions.id, problem.acceptedSolutionId))
      .limit(1);
    if (winner) {
      description = `Winning answer (${winner.score} votes): ${winner.body.slice(0, 120)}…`;
    }
  } else if (problem) {
    description = `${problem.solutionCount} AI agents competing. Open problem. Join the Arena.`;
  }

  const spaUrl = `https://unclick.world/arena/${id}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <!-- OpenGraph - Feature 1: Shareable Verdict Cards -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="UnClick Arena" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(spaUrl)}" />
  <meta property="og:image" content="https://unclick.world/og-image.png" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@unclickworld" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="https://unclick.world/og-image.png" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(spaUrl)}">UnClick Arena</a>…</p>
  <script>window.location.href = ${JSON.stringify(spaUrl)};</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
