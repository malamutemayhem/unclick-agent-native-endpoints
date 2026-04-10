// Pinterest visual discovery API.
// Docs: https://developers.pinterest.com/docs/api/v5/
// Auth: PINTEREST_ACCESS_TOKEN (Bearer)
// Base: https://api.pinterest.com/v5

const PINTEREST_BASE = "https://api.pinterest.com/v5";

function getToken(args: Record<string, unknown>): string {
  const token = String(args.access_token ?? process.env.PINTEREST_ACCESS_TOKEN ?? "").trim();
  if (!token) throw new Error("access_token is required (or set PINTEREST_ACCESS_TOKEN env var).");
  return token;
}

async function pinterestGet(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${PINTEREST_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) throw new Error("Invalid Pinterest access token.");
  if (res.status === 403) throw new Error("Pinterest: access forbidden. Ensure your token has the required scopes.");
  if (res.status === 404) throw new Error(`Pinterest: resource not found at ${path}.`);
  if (res.status === 429) throw new Error("Pinterest rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pinterest HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

async function pinterestPost(
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${PINTEREST_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Invalid Pinterest access token.");
  if (res.status === 403) throw new Error("Pinterest: access forbidden.");
  if (res.status === 429) throw new Error("Pinterest rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`Pinterest HTTP ${res.status}: ${b || res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

// list_pinterest_boards
export async function listPinterestBoards(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const params: Record<string, string> = {};
    if (args.page_size) params.page_size = String(args.page_size);
    if (args.bookmark) params.bookmark = String(args.bookmark);
    if (args.privacy) params.privacy = String(args.privacy);

    const json = await pinterestGet(token, "/boards", params) as Record<string, unknown>;
    const items = (json.items ?? []) as Array<Record<string, unknown>>;
    return {
      count: items.length,
      bookmark: json.bookmark,
      boards: items.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        privacy: b.privacy,
        pin_count: b.pin_count,
        follower_count: b.follower_count,
        created_at: b.created_at,
        media: b.media,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_pinterest_board
export async function getPinterestBoard(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    return pinterestGet(token, `/boards/${boardId}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_pinterest_pins
export async function listPinterestPins(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const params: Record<string, string> = {};
    if (args.page_size) params.page_size = String(args.page_size);
    if (args.bookmark) params.bookmark = String(args.bookmark);
    if (args.creative_types) params.creative_types = String(args.creative_types);

    const json = await pinterestGet(token, `/boards/${boardId}/pins`, params) as Record<string, unknown>;
    const items = (json.items ?? []) as Array<Record<string, unknown>>;
    return {
      count: items.length,
      bookmark: json.bookmark,
      pins: items.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        link: p.link,
        media: p.media,
        board_id: p.board_id,
        created_at: p.created_at,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_pinterest_pin
export async function createPinterestPin(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const mediaSourceUrl = String(args.media_source_url ?? "").trim();
    if (!mediaSourceUrl) return { error: "media_source_url is required." };

    const body: Record<string, unknown> = {
      board_id: boardId,
      media_source: { source_type: "image_url", url: mediaSourceUrl },
    };
    if (args.title) body.title = String(args.title);
    if (args.description) body.description = String(args.description);
    if (args.link) body.link = String(args.link);
    if (args.board_section_id) body.board_section_id = String(args.board_section_id);

    return pinterestPost(token, "/pins", body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// search_pinterest_pins
export async function searchPinterestPins(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const query = String(args.query ?? "").trim();
    if (!query) return { error: "query is required." };
    const params: Record<string, string> = { query };
    if (args.page_size) params.page_size = String(args.page_size);
    if (args.bookmark) params.bookmark = String(args.bookmark);

    const json = await pinterestGet(token, "/pins/search", params) as Record<string, unknown>;
    const items = (json.items ?? []) as Array<Record<string, unknown>>;
    return {
      count: items.length,
      bookmark: json.bookmark,
      pins: items.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        link: p.link,
        media: p.media,
        board_id: p.board_id,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_pinterest_user
export async function getPinterestUser(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const json = await pinterestGet(token, "/user_account") as Record<string, unknown>;
    return {
      username: json.username,
      account_type: json.account_type,
      profile_image: json.profile_image,
      website_url: json.website_url,
      pin_count: json.pin_count,
      follower_count: json.follower_count,
      following_count: json.following_count,
      board_count: json.board_count,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
