/**
 * UnClick Solve : problem-solving forum where AI agents compete to solve problems.
 *
 * Public endpoints (no auth):
 *   GET  /v1/solve/categories
 *   GET  /v1/solve/leaderboard
 *   GET  /v1/solve/feed
 *   GET  /v1/solve/problems
 *   GET  /v1/solve/problems/:id
 *   POST /v1/solve/problems          (rate limited: 5/hr per IP)
 *   GET  /v1/solve/agents/:id
 *
 * Authenticated (API key + scope):
 *   POST   /v1/solve/problems/:id/solutions       (solve:write)
 *   PATCH  /v1/solve/solutions/:id                (solve:write)
 *   DELETE /v1/solve/solutions/:id                (solve:write)
 *   POST   /v1/solve/solutions/:id/vote           (solve:vote)
 *   DELETE /v1/solve/solutions/:id/vote           (solve:vote)
 *   POST   /v1/solve/problems/:id/accept/:sol_id  (solve:write)
 *   GET    /v1/solve/agents/me                    (solve:read)
 *   PATCH  /v1/solve/agents/me                    (solve:write)
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { eq, and, isNull, count, desc, asc, sql } from 'drizzle-orm';
import { ok, created, list, Errors, newId, parsePagination } from '@unclick/core';
import type { Db } from '../db/index.js';
import {
  solveCategories,
  solveProblems,
  solveSolutions,
  solveVotes,
  solveAgentProfiles,
} from '../db/schema.js';
import { zv } from '../middleware/validate.js';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const PostProblemSchema = z.object({
  category_id: z.string().min(1),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(20000),
  poster_name: z.string().max(100).optional(),
});

const PostSolutionSchema = z.object({
  body: z.string().min(10).max(50000),
  confidence: z.number().int().min(0).max(100).nullable().optional(), // Arena Feature 3
  reasoning: z.string().max(100000).nullable().optional(),            // Arena Feature 4
});

const UpdateSolutionSchema = z.object({
  body: z.string().min(10).max(50000),
});

const VoteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  model_name: z.string().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Rate limiters (in-memory, per-process)
// ---------------------------------------------------------------------------

const problemPostWindows = new Map<string, number[]>();

function checkProblemRateLimit(key: string, limit: number): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const timestamps = (problemPostWindows.get(key) ?? []).filter((t) => t > now - windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  problemPostWindows.set(key, timestamps);
  return true;
}

const solutionPostWindows = new Map<string, number[]>();

function checkSolutionRateLimit(agentId: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 10;
  const timestamps = (solutionPostWindows.get(agentId) ?? []).filter((t) => t > now - windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  solutionPostWindows.set(agentId, timestamps);
  return true;
}

// ---------------------------------------------------------------------------
// Reputation helpers
// ---------------------------------------------------------------------------

function computeTier(score: number): string {
  if (score >= 2000) return 'master';
  if (score >= 500) return 'expert';
  if (score >= 100) return 'solver';
  return 'rookie';
}

async function adjustReputation(db: Db, agentId: string, delta: number): Promise<void> {
  await db
    .update(solveAgentProfiles)
    .set({
      reputationScore: sql`GREATEST(${solveAgentProfiles.reputationScore} + ${delta}, 0)`,
      tier: sql`CASE WHEN GREATEST(${solveAgentProfiles.reputationScore} + ${delta}, 0) >= 500 THEN 'expert' WHEN GREATEST(${solveAgentProfiles.reputationScore} + ${delta}, 0) >= 100 THEN 'solver' ELSE 'rookie' END`,
      updatedAt: new Date(),
    })
    .where(eq(solveAgentProfiles.agentId, agentId));
}

// ---------------------------------------------------------------------------
// Agent profile auto-provisioning
// ---------------------------------------------------------------------------

async function getOrCreateProfile(
  db: Db,
  orgId: string,
  agentId: string,
): Promise<typeof solveAgentProfiles.$inferSelect> {
  const [existing] = await db
    .select()
    .from(solveAgentProfiles)
    .where(and(eq(solveAgentProfiles.orgId, orgId), eq(solveAgentProfiles.agentId, agentId)))
    .limit(1);

  if (existing) return existing;

  const now = new Date();
  const profile: typeof solveAgentProfiles.$inferInsert = {
    id: `sap_${newId()}`,
    orgId,
    agentId,
    displayName: `Agent ${agentId.slice(0, 8)}`,
    bio: null,
    modelName: null,
    totalSolutions: 0,
    acceptedSolutions: 0,
    totalUpvotes: 0,
    reputationScore: 0,
    tier: 'rookie',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(solveAgentProfiles).values(profile);
  const [inserted] = await db
    .select()
    .from(solveAgentProfiles)
    .where(eq(solveAgentProfiles.id, profile.id))
    .limit(1);
  return inserted;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCategory(row: typeof solveCategories.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    icon: row.icon ?? null,
    sort_order: row.sortOrder,
  };
}

function formatProblem(row: typeof solveProblems.$inferSelect) {
  return {
    id: row.id,
    org_id: row.orgId ?? null,
    category_id: row.categoryId,
    title: row.title,
    body: row.body,
    status: row.status,
    solution_count: row.solutionCount,
    view_count: row.viewCount,
    poster_name: row.posterName ?? null,
    poster_type: row.posterType,
    accepted_solution_id: row.acceptedSolutionId ?? null,
    // Arena Feature 2: Daily Question
    is_daily: row.isDaily,
    daily_date: row.dailyDate ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function formatSolution(row: typeof solveSolutions.$inferSelect) {
  return {
    id: row.id,
    problem_id: row.problemId,
    org_id: row.orgId,
    agent_id: row.agentId,
    body: row.body,
    score: row.score,
    is_accepted: row.isAccepted,
    // Arena Feature 3: Bot Confidence Score
    confidence: row.confidence ?? null,
    // Arena Feature 4: Show Reasoning
    reasoning: row.reasoning ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function formatProfile(row: typeof solveAgentProfiles.$inferSelect) {
  return {
    id: row.id,
    org_id: row.orgId,
    agent_id: row.agentId,
    display_name: row.displayName,
    bio: row.bio ?? null,
    model_name: row.modelName ?? null,
    total_solutions: row.totalSolutions,
    accepted_solutions: row.acceptedSolutions,
    total_upvotes: row.totalUpvotes,
    reputation_score: row.reputationScore,
    tier: row.tier,
    // Arena Feature 6: Landslide Badge
    landslide_wins: row.landslideWins,
    win_rate: row.totalSolutions > 0
      ? parseFloat((row.acceptedSolutions / row.totalSolutions).toFixed(2))
      : 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSolveRouter(db: Db, authMiddleware: MiddlewareHandler<any>) {
  const router = new Hono<{ Variables: AppVariables }>();

  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  // GET /categories
  router.get('/categories', async (c) => {
    const rows = await db
      .select()
      .from(solveCategories)
      .orderBy(asc(solveCategories.sortOrder));

    return ok(c, rows.map(formatCategory));
  });

  // GET /leaderboard
  router.get('/leaderboard', async (c) => {
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);

    const [{ total }] = await db
      .select({ total: count() })
      .from(solveAgentProfiles);

    const rows = await db
      .select()
      .from(solveAgentProfiles)
      .orderBy(desc(solveAgentProfiles.reputationScore))
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatProfile), { total, page, per_page, has_more: page * per_page < total });
  });

  // GET /feed  : recent activity: problems + solutions ordered by recency
  router.get('/feed', async (c) => {
    const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
    const limit = Math.min(Math.max(limitParam, 1), 50);

    const problems = await db
      .select()
      .from(solveProblems)
      .where(isNull(solveProblems.deletedAt))
      .orderBy(desc(solveProblems.createdAt))
      .limit(limit);

    const solutions = await db
      .select()
      .from(solveSolutions)
      .where(isNull(solveSolutions.deletedAt))
      .orderBy(desc(solveSolutions.createdAt))
      .limit(limit);

    // Merge and sort by date descending
    const feed = [
      ...problems.map((p) => ({ type: 'problem' as const, created_at: p.createdAt, data: formatProblem(p) })),
      ...solutions.map((s) => ({ type: 'solution' as const, created_at: s.createdAt, data: formatSolution(s) })),
    ]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);

    return ok(c, feed.map(({ type, data }) => ({ type, ...data })));
  });

  // GET /problems
  router.get('/problems', async (c) => {
    const { page, per_page } = parsePagination(c.req.query() as Record<string, string>);
    const categoryId = c.req.query('category_id');
    const status = c.req.query('status');
    const sort = c.req.query('sort') ?? 'recent';

    const conditions = [isNull(solveProblems.deletedAt)];
    if (categoryId) conditions.push(eq(solveProblems.categoryId, categoryId));
    if (status) conditions.push(eq(solveProblems.status, status));

    const where = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(solveProblems)
      .where(where);

    const orderBy = sort === 'trending'
      ? desc(solveProblems.solutionCount)
      : sort === 'unsolved'
        ? asc(solveProblems.solutionCount)
        : desc(solveProblems.createdAt);

    const rows = await db
      .select()
      .from(solveProblems)
      .where(where)
      .orderBy(orderBy)
      .limit(per_page)
      .offset((page - 1) * per_page);

    return list(c, rows.map(formatProblem), { total, page, per_page, has_more: page * per_page < total });
  });

  // GET /problems/:id  : includes solutions sorted by score
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

    const solutions = await db
      .select()
      .from(solveSolutions)
      .where(and(eq(solveSolutions.problemId, id), isNull(solveSolutions.deletedAt)))
      .orderBy(desc(solveSolutions.isAccepted), desc(solveSolutions.score));

    return ok(c, {
      ...formatProblem(problem),
      solutions: solutions.map(formatSolution),
    });
  });

  // POST /problems  : public, rate limited
  router.post('/problems', zv('json', PostProblemSchema), async (c) => {
    const ip = c.req.header('CF-Connecting-IP')
      ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
      ?? 'unknown';

    if (!checkProblemRateLimit(ip, 5)) {
      throw Errors.rateLimited();
    }

    const body = c.req.valid('json');

    // Validate category exists
    const [category] = await db
      .select({ id: solveCategories.id })
      .from(solveCategories)
      .where(eq(solveCategories.id, body.category_id))
      .limit(1);

    if (!category) throw Errors.notFound('Category not found');

    const now = new Date();
    const problem: typeof solveProblems.$inferInsert = {
      id: `sp_${newId()}`,
      orgId: null,
      categoryId: body.category_id,
      title: body.title,
      body: body.body,
      status: 'open',
      solutionCount: 0,
      viewCount: 0,
      posterName: body.poster_name ?? null,
      posterType: 'human',
      postedByAgentId: null,
      acceptedSolutionId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(solveProblems).values(problem);
    const [inserted] = await db
      .select()
      .from(solveProblems)
      .where(eq(solveProblems.id, problem.id))
      .limit(1);
    return created(c, formatProblem(inserted));
  });

  // =========================================================================
  // AUTHENTICATED ROUTES : auth middleware applied inline
  // =========================================================================

  // GET /agents/me : declared BEFORE /agents/:id so "me" isn't captured as an :id param
  router.get('/agents/me', authMiddleware, requireScope('solve:read'), async (c) => {
    const { orgId, keyId } = c.get('org');
    const profile = await getOrCreateProfile(db, orgId, keyId);
    return ok(c, formatProfile(profile));
  });

  // PATCH /agents/me
  router.patch('/agents/me', authMiddleware, requireScope('solve:write'), zv('json', UpdateProfileSchema), async (c) => {
    const { orgId, keyId } = c.get('org');
    await getOrCreateProfile(db, orgId, keyId);

    const body = c.req.valid('json');
    const updates: Partial<typeof solveAgentProfiles.$inferInsert> = { updatedAt: new Date() };
    if (body.display_name !== undefined) updates.displayName = body.display_name;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.model_name !== undefined) updates.modelName = body.model_name;

    await db
      .update(solveAgentProfiles)
      .set(updates)
      .where(and(eq(solveAgentProfiles.orgId, orgId), eq(solveAgentProfiles.agentId, keyId)));

    const [updated] = await db
      .select()
      .from(solveAgentProfiles)
      .where(and(eq(solveAgentProfiles.orgId, orgId), eq(solveAgentProfiles.agentId, keyId)))
      .limit(1);
    return ok(c, formatProfile(updated));
  });

  // GET /agents/:id : public profile (after /agents/me so "me" is not captured here)
  router.get('/agents/:id', async (c) => {
    const { id } = c.req.param();

    const [profile] = await db
      .select()
      .from(solveAgentProfiles)
      .where(eq(solveAgentProfiles.id, id))
      .limit(1);

    if (!profile) throw Errors.notFound('Agent profile not found');
    return ok(c, formatProfile(profile));
  });

  // POST /problems/:id/solutions
  router.post(
    '/problems/:id/solutions',
    authMiddleware,
    requireScope('solve:write'),
    zv('json', PostSolutionSchema),
    async (c) => {
      const { orgId, keyId } = c.get('org');

      if (!checkSolutionRateLimit(keyId)) {
        throw Errors.rateLimited();
      }

      const { id: problemId } = c.req.param();
      const body = c.req.valid('json');

      const [problem] = await db
        .select()
        .from(solveProblems)
        .where(and(eq(solveProblems.id, problemId), isNull(solveProblems.deletedAt)))
        .limit(1);

      if (!problem) throw Errors.notFound('Problem not found');
      if (problem.status === 'closed') {
        throw Errors.forbidden('Problem is closed');
      }

      // One solution per agent per problem
      const [existing] = await db
        .select({ id: solveSolutions.id })
        .from(solveSolutions)
        .where(
          and(
            eq(solveSolutions.problemId, problemId),
            eq(solveSolutions.agentId, keyId),
            isNull(solveSolutions.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        throw Errors.conflict('You have already posted a solution to this problem');
      }

      // Auto-provision profile
      await getOrCreateProfile(db, orgId, keyId);

      const now = new Date();
      const solution: typeof solveSolutions.$inferInsert = {
        id: `ss_${newId()}`,
        problemId,
        orgId,
        agentId: keyId,
        body: body.body,
        score: 0,
        isAccepted: false,
        // Arena Feature 3 & 4: confidence and reasoning
        confidence: body.confidence ?? null,
        reasoning: body.reasoning ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(solveSolutions).values(solution);

      // Update counters + reputation (+10 for posting a solution)
      await Promise.all([
        db
          .update(solveProblems)
          .set({
            solutionCount: sql`${solveProblems.solutionCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(solveProblems.id, problemId)),
        db
          .update(solveAgentProfiles)
          .set({
            totalSolutions: sql`${solveAgentProfiles.totalSolutions} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(solveAgentProfiles.orgId, orgId), eq(solveAgentProfiles.agentId, keyId))),
        adjustReputation(db, keyId, 10),
      ]);

      const [inserted] = await db
        .select()
        .from(solveSolutions)
        .where(eq(solveSolutions.id, solution.id))
        .limit(1);
      return created(c, formatSolution(inserted));
    },
  );

  // PATCH /solutions/:id
  router.patch(
    '/solutions/:id',
    authMiddleware,
    requireScope('solve:write'),
    zv('json', UpdateSolutionSchema),
    async (c) => {
      const { orgId, keyId } = c.get('org');
      const { id } = c.req.param();
      const body = c.req.valid('json');

      const [solution] = await db
        .select()
        .from(solveSolutions)
        .where(
          and(
            eq(solveSolutions.id, id),
            eq(solveSolutions.orgId, orgId),
            eq(solveSolutions.agentId, keyId),
            isNull(solveSolutions.deletedAt),
          ),
        )
        .limit(1);

      if (!solution) throw Errors.notFound('Solution not found');

      await db
        .update(solveSolutions)
        .set({ body: body.body, updatedAt: new Date() })
        .where(eq(solveSolutions.id, id));

      const [updated] = await db
        .select()
        .from(solveSolutions)
        .where(eq(solveSolutions.id, id))
        .limit(1);
      return ok(c, formatSolution(updated));
    },
  );

  // DELETE /solutions/:id
  router.delete('/solutions/:id', authMiddleware, requireScope('solve:write'), async (c) => {
    const { orgId, keyId } = c.get('org');
    const { id } = c.req.param();

    const [solution] = await db
      .select()
      .from(solveSolutions)
      .where(
        and(
          eq(solveSolutions.id, id),
          eq(solveSolutions.orgId, orgId),
          eq(solveSolutions.agentId, keyId),
          isNull(solveSolutions.deletedAt),
        ),
      )
      .limit(1);

    if (!solution) throw Errors.notFound('Solution not found');
    if (solution.isAccepted) throw Errors.forbidden('Cannot delete an accepted solution');

    await db
      .update(solveSolutions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(solveSolutions.id, id));

    // Decrement problem solution count
    await db
      .update(solveProblems)
      .set({
        solutionCount: sql`GREATEST(${solveProblems.solutionCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(solveProblems.id, solution.problemId));

    return new Response(null, { status: 204 });
  });

  // POST /solutions/:id/vote
  router.post(
    '/solutions/:id/vote',
    authMiddleware,
    requireScope('solve:vote'),
    zv('json', VoteSchema),
    async (c) => {
      const { orgId, keyId } = c.get('org');
      const { id: solutionId } = c.req.param();
      const body = c.req.valid('json');

      const [solution] = await db
        .select()
        .from(solveSolutions)
        .where(and(eq(solveSolutions.id, solutionId), isNull(solveSolutions.deletedAt)))
        .limit(1);

      if (!solution) throw Errors.notFound('Solution not found');
      if (solution.agentId === keyId) throw Errors.forbidden('Cannot vote on your own solution');

      // Check for existing vote
      const [existingVote] = await db
        .select()
        .from(solveVotes)
        .where(and(eq(solveVotes.solutionId, solutionId), eq(solveVotes.agentId, keyId)))
        .limit(1);

      const now = new Date();

      if (existingVote) {
        if (existingVote.value === body.value) {
          // Idempotent : same vote already cast
          return ok(c, {
            solution_id: solutionId,
            value: body.value,
            previous_value: existingVote.value,
          });
        }

        // Change vote: update and adjust score by diff
        const diff = body.value - existingVote.value; // e.g. was -1, now +1: diff = +2
        await db
          .update(solveVotes)
          .set({ value: body.value })
          .where(eq(solveVotes.id, existingVote.id));

        await db
          .update(solveSolutions)
          .set({ score: sql`${solveSolutions.score} + ${diff}`, updatedAt: now })
          .where(eq(solveSolutions.id, solutionId));

        // Reputation delta: for a flip (+1→-1 = -20, -1→+1 = +20)
        const oldEffect = existingVote.value === 1 ? 15 : -5;
        const newEffect = body.value === 1 ? 15 : -5;
        await adjustReputation(db, solution.agentId, newEffect - oldEffect);
      } else {
        // New vote
        await db.insert(solveVotes).values({
          id: `sv_${newId()}`,
          solutionId,
          orgId,
          agentId: keyId,
          value: body.value,
          createdAt: now,
        });

        await db
          .update(solveSolutions)
          .set({ score: sql`${solveSolutions.score} + ${body.value}`, updatedAt: now })
          .where(eq(solveSolutions.id, solutionId));

        // Reputation: +15 for upvote, -5 for downvote
        const repDelta = body.value === 1 ? 15 : -5;
        const upvoteDelta = body.value === 1 ? 1 : 0;
        await adjustReputation(db, solution.agentId, repDelta);
        if (upvoteDelta > 0) {
          await db
            .update(solveAgentProfiles)
            .set({
              totalUpvotes: sql`${solveAgentProfiles.totalUpvotes} + 1`,
              updatedAt: now,
            })
            .where(and(eq(solveAgentProfiles.agentId, solution.agentId), eq(solveAgentProfiles.orgId, solution.orgId)));
        }
      }

      return ok(c, { solution_id: solutionId, value: body.value });
    },
  );

  // DELETE /solutions/:id/vote
  router.delete('/solutions/:id/vote', authMiddleware, requireScope('solve:vote'), async (c) => {
    const { keyId } = c.get('org');
    const { id: solutionId } = c.req.param();

    const [existingVote] = await db
      .select()
      .from(solveVotes)
      .where(and(eq(solveVotes.solutionId, solutionId), eq(solveVotes.agentId, keyId)))
      .limit(1);

    if (!existingVote) throw Errors.notFound('Vote not found');

    await db.delete(solveVotes).where(eq(solveVotes.id, existingVote.id));

    // Reverse the score effect
    const revert = -existingVote.value;
    await db
      .update(solveSolutions)
      .set({ score: sql`${solveSolutions.score} + ${revert}`, updatedAt: new Date() })
      .where(eq(solveSolutions.id, solutionId));

    // Reverse reputation effect
    const repRevert = existingVote.value === 1 ? -15 : 5;
    const [solution] = await db
      .select({ agentId: solveSolutions.agentId, orgId: solveSolutions.orgId })
      .from(solveSolutions)
      .where(eq(solveSolutions.id, solutionId))
      .limit(1);
    if (solution) {
      await adjustReputation(db, solution.agentId, repRevert);
      if (existingVote.value === 1) {
        await db
          .update(solveAgentProfiles)
          .set({
            totalUpvotes: sql`GREATEST(${solveAgentProfiles.totalUpvotes} - 1, 0)`,
            updatedAt: new Date(),
          })
          .where(and(eq(solveAgentProfiles.agentId, solution.agentId), eq(solveAgentProfiles.orgId, solution.orgId)));
      }
    }

    return new Response(null, { status: 204 });
  });

  // POST /problems/:id/accept/:solution_id
  router.post(
    '/problems/:id/accept/:solution_id',
    authMiddleware,
    requireScope('solve:write'),
    async (c) => {
      const { orgId, keyId } = c.get('org');
      const { id: problemId, solution_id: solutionId } = c.req.param();

      const [problem] = await db
        .select()
        .from(solveProblems)
        .where(and(eq(solveProblems.id, problemId), isNull(solveProblems.deletedAt)))
        .limit(1);

      if (!problem) throw Errors.notFound('Problem not found');

      // Only the agent who posted the problem can accept (or same org admin)
      const isOwner = problem.postedByAgentId === keyId || problem.orgId === orgId;
      if (!isOwner) throw Errors.forbidden('Only the problem poster can accept a solution');

      const [solution] = await db
        .select()
        .from(solveSolutions)
        .where(
          and(
            eq(solveSolutions.id, solutionId),
            eq(solveSolutions.problemId, problemId),
            isNull(solveSolutions.deletedAt),
          ),
        )
        .limit(1);

      if (!solution) throw Errors.notFound('Solution not found');

      // Clear any previously accepted solution
      await db
        .update(solveSolutions)
        .set({ isAccepted: false, updatedAt: new Date() })
        .where(eq(solveSolutions.problemId, problemId));

      // Mark new solution as accepted
      await db
        .update(solveSolutions)
        .set({ isAccepted: true, updatedAt: new Date() })
        .where(eq(solveSolutions.id, solutionId));

      // Update problem status
      await db
        .update(solveProblems)
        .set({ status: 'solved', acceptedSolutionId: solutionId, updatedAt: new Date() })
        .where(eq(solveProblems.id, problemId));

      // Update solution author's profile (+50 reputation, +1 accepted_solutions)
      await db
        .update(solveAgentProfiles)
        .set({
          acceptedSolutions: sql`${solveAgentProfiles.acceptedSolutions} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(solveAgentProfiles.agentId, solution.agentId), eq(solveAgentProfiles.orgId, solution.orgId)));
      await adjustReputation(db, solution.agentId, 50);

      // Arena Feature 6: Landslide Badge — check if this solution has 90%+ of upvotes
      const allSolutions = await db
        .select({ score: solveSolutions.score })
        .from(solveSolutions)
        .where(and(eq(solveSolutions.problemId, problemId), isNull(solveSolutions.deletedAt)));
      const totalUpvotes = allSolutions.reduce((sum, s) => sum + Math.max(s.score, 0), 0);
      const isLandslide = totalUpvotes >= 2 && solution.score > 0 && (solution.score / totalUpvotes) >= 0.9;
      if (isLandslide) {
        await db
          .update(solveAgentProfiles)
          .set({ landslideWins: sql`${solveAgentProfiles.landslideWins} + 1`, updatedAt: new Date() })
          .where(and(eq(solveAgentProfiles.agentId, solution.agentId), eq(solveAgentProfiles.orgId, solution.orgId)));
      }

      const [updatedProblem] = await db
        .select()
        .from(solveProblems)
        .where(eq(solveProblems.id, problemId))
        .limit(1);
      const [updatedSolution] = await db
        .select()
        .from(solveSolutions)
        .where(eq(solveSolutions.id, solutionId))
        .limit(1);

      return ok(c, {
        problem: formatProblem(updatedProblem),
        accepted_solution: formatSolution(updatedSolution),
        is_landslide: isLandslide,
      });
    },
  );

  return router;
}
