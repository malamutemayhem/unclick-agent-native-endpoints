// Hacker News Firebase API integration.
// No authentication required — completely open.
// Base URL: https://hacker-news.firebaseio.com/v0/

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

// ─── API helper ───────────────────────────────────────────────────────────────

async function hnFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${HN_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`HN API HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface HNItem {
  id: number;
  type: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
  parent?: number;
  poll?: number;
}

interface HNUser {
  id: string;
  created?: number;
  karma?: number;
  about?: string;
  submitted?: number[];
}

function normalizeItem(item: HNItem) {
  return {
    id: item.id,
    type: item.type,
    by: item.by ?? null,
    time: item.time ? new Date(item.time * 1000).toISOString() : null,
    title: item.title ?? null,
    url: item.url ?? null,
    text: item.text ?? null,
    score: item.score ?? null,
    comments: item.descendants ?? null,
    comment_ids: item.kids ?? [],
  };
}

// Fetch up to `limit` story items from an ID list in parallel.
async function fetchStories(ids: number[], limit: number): Promise<unknown[]> {
  const top = ids.slice(0, Math.min(limit, ids.length));
  const items = await Promise.all(
    top.map((id) => hnFetch<HNItem>(`/item/${id}.json`))
  );
  return items.filter((i) => i && !i.deleted && !i.dead).map(normalizeItem);
}

// ─── hn_top_stories ───────────────────────────────────────────────────────────

export async function hnTopStories(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(30, Math.max(1, Number(args.limit ?? 10)));
  const ids = await hnFetch<number[]>("/topstories.json");
  const stories = await fetchStories(ids, limit);
  return { count: stories.length, feed: "top", stories };
}

// ─── hn_new_stories ───────────────────────────────────────────────────────────

export async function hnNewStories(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(30, Math.max(1, Number(args.limit ?? 10)));
  const ids = await hnFetch<number[]>("/newstories.json");
  const stories = await fetchStories(ids, limit);
  return { count: stories.length, feed: "new", stories };
}

// ─── hn_best_stories ──────────────────────────────────────────────────────────

export async function hnBestStories(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(30, Math.max(1, Number(args.limit ?? 10)));
  const ids = await hnFetch<number[]>("/beststories.json");
  const stories = await fetchStories(ids, limit);
  return { count: stories.length, feed: "best", stories };
}

// ─── hn_ask_hn ────────────────────────────────────────────────────────────────

export async function hnAskHn(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(30, Math.max(1, Number(args.limit ?? 10)));
  const ids = await hnFetch<number[]>("/askstories.json");
  const stories = await fetchStories(ids, limit);
  return { count: stories.length, feed: "ask", stories };
}

// ─── hn_show_hn ───────────────────────────────────────────────────────────────

export async function hnShowHn(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(30, Math.max(1, Number(args.limit ?? 10)));
  const ids = await hnFetch<number[]>("/showstories.json");
  const stories = await fetchStories(ids, limit);
  return { count: stories.length, feed: "show", stories };
}

// ─── hn_item ─────────────────────────────────────────────────────────────────

export async function hnItem(args: Record<string, unknown>): Promise<unknown> {
  const id = Number(args.id);
  if (!id) return { error: "id is required (numeric Hacker News item ID)." };

  const item = await hnFetch<HNItem>(`/item/${id}.json`);
  if (!item) return { error: `Item ${id} not found.` };

  return normalizeItem(item);
}

// ─── hn_user ──────────────────────────────────────────────────────────────────

export async function hnUser(args: Record<string, unknown>): Promise<unknown> {
  const username = String(args.username ?? "").trim();
  if (!username) return { error: "username is required." };

  const user = await hnFetch<HNUser>(`/user/${username}.json`);
  if (!user) return { error: `User "${username}" not found.` };

  return {
    id: user.id,
    created: user.created ? new Date(user.created * 1000).toISOString() : null,
    karma: user.karma ?? 0,
    about: user.about ?? null,
    submission_count: Array.isArray(user.submitted) ? user.submitted.length : 0,
    recent_submissions: Array.isArray(user.submitted) ? user.submitted.slice(0, 10) : [],
  };
}
