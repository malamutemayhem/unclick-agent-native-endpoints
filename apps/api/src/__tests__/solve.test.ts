import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb } from './setup.js';

let app: ReturnType<typeof createApp>;
let devKey: string;

function authHeader(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

beforeAll(async () => {
  devKey = await setupTestDb();
  app = createApp();
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe('Solve — categories', () => {
  it('lists seeded categories', async () => {
    const res = await app.request('/v1/solve/categories');
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; slug: string }[] }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(8);
    const slugs = body.data.map((c) => c.slug);
    expect(slugs).toContain('automation');
    expect(slugs).toContain('data');
  });
});

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

describe('Solve — problems', () => {
  let problemId: string;
  let categoryId: string;

  beforeAll(async () => {
    const res = await app.request('/v1/solve/categories');
    const body = await json<{ data: { id: string; slug: string }[] }>(res);
    categoryId = body.data.find((c) => c.slug === 'automation')!.id;
  });

  it('creates a problem (public, no auth)', async () => {
    const res = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'How do I chain three API calls with retry?',
        body: 'I need to call API A, pass to API B, then aggregate with API C. Each needs exponential backoff.',
        poster_name: 'TestHuman',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; status: string; poster_type: string } }>(res);
    expect(body.data.status).toBe('open');
    expect(body.data.poster_type).toBe('human');
    problemId = body.data.id;
  });

  it('returns 404 for unknown category', async () => {
    const res = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: 'cat_nonexistent',
        title: 'This should fail',
        body: 'Category does not exist in the database.',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects problems with too-short body', async () => {
    const res = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'Bad',
        body: 'Short',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('lists problems', async () => {
    const res = await app.request('/v1/solve/problems');
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; meta: { pagination: { total: number } } }>(res);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('filters problems by category', async () => {
    const res = await app.request(`/v1/solve/problems?category_id=${categoryId}`);
    expect(res.status).toBe(200);
    const body = await json<{ data: { category_id: string }[] }>(res);
    for (const p of body.data) {
      expect(p.category_id).toBe(categoryId);
    }
  });

  it('gets a problem by id with empty solutions', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}`);
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; solutions: unknown[] } }>(res);
    expect(body.data.id).toBe(problemId);
    expect(Array.isArray(body.data.solutions)).toBe(true);
  });

  it('returns 404 for nonexistent problem', async () => {
    const res = await app.request('/v1/solve/problems/sp_doesnotexist');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Solutions
// ---------------------------------------------------------------------------

describe('Solve — solutions', () => {
  let problemId: string;
  let solutionId: string;
  let categoryId: string;

  beforeAll(async () => {
    const catRes = await app.request('/v1/solve/categories');
    const catBody = await json<{ data: { id: string; slug: string }[] }>(catRes);
    categoryId = catBody.data.find((c) => c.slug === 'data')!.id;

    // Create a problem for solution tests
    const pRes = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'How do I parse deeply nested JSON efficiently?',
        body: 'I have a deeply nested JSON structure with unknown depth and need to flatten it programmatically.',
      }),
    });
    const pBody = await json<{ data: { id: string } }>(pRes);
    problemId = pBody.data.id;
  });

  it('requires auth to post a solution', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}/solutions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Use a recursive function to flatten the JSON.' }),
    });
    expect(res.status).toBe(401);
  });

  it('posts a solution (authenticated)', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}/solutions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Use a recursive flattening function. Here is the pattern:\n\nfunction flatten(obj, prefix = "") { ... }',
      }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ data: { id: string; score: number; is_accepted: boolean } }>(res);
    expect(body.data.score).toBe(0);
    expect(body.data.is_accepted).toBe(false);
    solutionId = body.data.id;
  });

  it('prevents duplicate solution for same agent on same problem', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}/solutions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'A second solution attempt should fail for the same agent.' }),
    });
    expect(res.status).toBe(409);
  });

  it('problem solution_count incremented after posting', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}`);
    const body = await json<{ data: { solution_count: number } }>(res);
    expect(body.data.solution_count).toBe(1);
  });

  it('updates own solution', async () => {
    const res = await app.request(`/v1/solve/solutions/${solutionId}`, {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Updated: Use a recursive flattening function with memoization for better performance.',
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { body: string } }>(res);
    expect(body.data.body).toContain('memoization');
  });

  it('deletes own solution', async () => {
    // Create another problem and solution for deletion test
    const pRes = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'Temp problem for delete test',
        body: 'This problem is only here to test solution deletion behavior.',
      }),
    });
    const pBody = await json<{ data: { id: string } }>(pRes);
    const tempProblemId = pBody.data.id;

    // Post another key — we can't delete the solutionId above (already patched successfully)
    // Instead, create a new problem and solution pair
    const sRes = await app.request(`/v1/solve/problems/${tempProblemId}/solutions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Temporary solution for the delete test case in this suite.' }),
    });
    const sBody = await json<{ data: { id: string } }>(sRes);
    const tempSolutionId = sBody.data.id;

    const delRes = await app.request(`/v1/solve/solutions/${tempSolutionId}`, {
      method: 'DELETE',
      headers: authHeader(devKey),
    });
    expect(delRes.status).toBe(204);

    // Solution should now be gone from problem detail
    const pDetailRes = await app.request(`/v1/solve/problems/${tempProblemId}`);
    const pDetailBody = await json<{ data: { solutions: { id: string }[] } }>(pDetailRes);
    expect(pDetailBody.data.solutions.find((s) => s.id === tempSolutionId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

describe('Solve — voting', () => {
  let problemId: string;
  let agentSolutionId: string;

  beforeAll(async () => {
    const catRes = await app.request('/v1/solve/categories');
    const catBody = await json<{ data: { id: string; slug: string }[] }>(catRes);
    const categoryId = catBody.data.find((c) => c.slug === 'web')!.id;

    const pRes = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'Best approach for web scraping with auth?',
        body: 'What is the most reliable pattern for scraping sites that require authentication including session management?',
      }),
    });
    const pBody = await json<{ data: { id: string } }>(pRes);
    problemId = pBody.data.id;

    // Post solution with same key (dev key)
    const sRes = await app.request(`/v1/solve/problems/${problemId}/solutions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Use Playwright with storageState to persist sessions across scraping runs.',
      }),
    });
    const sBody = await json<{ data: { id: string } }>(sRes);
    agentSolutionId = sBody.data.id;
  });

  it('cannot vote on own solution', async () => {
    const res = await app.request(`/v1/solve/solutions/${agentSolutionId}/vote`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it('requires auth to vote', async () => {
    const res = await app.request(`/v1/solve/solutions/${agentSolutionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 1 }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Accept solution
// ---------------------------------------------------------------------------

describe('Solve — accept solution', () => {
  let problemId: string;
  let solutionId: string;

  beforeAll(async () => {
    const catRes = await app.request('/v1/solve/categories');
    const catBody = await json<{ data: { id: string; slug: string }[] }>(catRes);
    const categoryId = catBody.data.find((c) => c.slug === 'scheduling')!.id;

    const pRes = await app.request('/v1/solve/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        title: 'How to handle recurring bookings with timezone changes?',
        body: 'I have recurring weekly bookings and need to handle DST transitions without double-booking or gaps.',
      }),
    });
    const pBody = await json<{ data: { id: string } }>(pRes);
    problemId = pBody.data.id;

    const sRes = await app.request(`/v1/solve/problems/${problemId}/solutions`, {
      method: 'POST',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Always store times in UTC and convert to local timezone at display time. Use a library like date-fns-tz for DST-aware conversions.',
      }),
    });
    const sBody = await json<{ data: { id: string } }>(sRes);
    solutionId = sBody.data.id;
  });

  it('requires auth to accept', async () => {
    const res = await app.request(`/v1/solve/problems/${problemId}/accept/${solutionId}`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('rejects acceptance by non-owner', async () => {
    // The problem was posted anonymously (no auth), so no agent owns it.
    // The dev key org IS different from the poster (poster has no org).
    // This should fail because problem.postedByAgentId is null and problem.orgId is null.
    const res = await app.request(`/v1/solve/problems/${problemId}/accept/${solutionId}`, {
      method: 'POST',
      headers: authHeader(devKey),
    });
    // Anonymous problems can only be accepted by someone with matching org (none here)
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Agent profiles
// ---------------------------------------------------------------------------

describe('Solve — agent profiles', () => {
  it('requires auth to get own profile', async () => {
    const res = await app.request('/v1/solve/agents/me');
    expect(res.status).toBe(401);
  });

  it('auto-provisions profile on first access', async () => {
    const res = await app.request('/v1/solve/agents/me', {
      headers: authHeader(devKey),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { tier: string; reputation_score: number } }>(res);
    expect(body.data.tier).toBeDefined();
    expect(typeof body.data.reputation_score).toBe('number');
  });

  it('updates own profile', async () => {
    const res = await app.request('/v1/solve/agents/me', {
      method: 'PATCH',
      headers: { ...authHeader(devKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'TestAgent Prime',
        bio: 'Solving problems since 2026.',
        model_name: 'Claude Sonnet',
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ data: { display_name: string; bio: string; model_name: string } }>(res);
    expect(body.data.display_name).toBe('TestAgent Prime');
    expect(body.data.bio).toBe('Solving problems since 2026.');
    expect(body.data.model_name).toBe('Claude Sonnet');
  });

  it('returns profile by id (public)', async () => {
    // Get own profile first to retrieve the ID
    const meRes = await app.request('/v1/solve/agents/me', {
      headers: authHeader(devKey),
    });
    const meBody = await json<{ data: { id: string } }>(meRes);
    const profileId = meBody.data.id;

    const res = await app.request(`/v1/solve/agents/${profileId}`);
    expect(res.status).toBe(200);
    const body = await json<{ data: { id: string; display_name: string } }>(res);
    expect(body.data.id).toBe(profileId);
  });
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

describe('Solve — leaderboard', () => {
  it('returns leaderboard (public)', async () => {
    const res = await app.request('/v1/solve/leaderboard');
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; meta: unknown }>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

describe('Solve — feed', () => {
  it('returns activity feed (public)', async () => {
    const res = await app.request('/v1/solve/feed');
    expect(res.status).toBe(200);
    const body = await json<{ data: { type: string }[] }>(res);
    expect(Array.isArray(body.data)).toBe(true);
    // Should include both problem and solution types
    const types = new Set(body.data.map((e) => e.type));
    expect(types.has('problem')).toBe(true);
  });

  it('respects limit param', async () => {
    const res = await app.request('/v1/solve/feed?limit=3');
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[] }>(res);
    expect(body.data.length).toBeLessThanOrEqual(3);
  });
});
