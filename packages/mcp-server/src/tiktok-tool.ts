// TikTok for Developers API.
// Docs: https://developers.tiktok.com/doc/tiktok-api-v2-introduction
// Auth: TIKTOK_ACCESS_TOKEN (Bearer, OAuth 2.0 user access token)
// Base: https://open.tiktokapis.com/v2

const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

function getToken(args: Record<string, unknown>): string {
  const token = String(args.access_token ?? process.env.TIKTOK_ACCESS_TOKEN ?? "").trim();
  if (!token) throw new Error("access_token is required (or set TIKTOK_ACCESS_TOKEN env var).");
  return token;
}

async function tiktokGet(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${TIKTOK_BASE}${path}`);
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
  if (res.status === 401) throw new Error("Invalid TikTok access token or token has expired. Re-authenticate via OAuth.");
  if (res.status === 403) throw new Error("TikTok: access forbidden. Ensure your app has the required scopes.");
  if (res.status === 429) throw new Error("TikTok rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TikTok HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const errObj = json.error as Record<string, unknown> | undefined;
  if (errObj?.code && errObj.code !== "ok") {
    throw new Error(`TikTok API error: ${errObj.message ?? errObj.code}`);
  }
  return json;
}

async function tiktokPost(
  token: string,
  path: string,
  body: Record<string, unknown>,
  fields?: string
): Promise<unknown> {
  const url = new URL(`${TIKTOK_BASE}${path}`);
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Invalid TikTok access token or token has expired.");
  if (res.status === 403) throw new Error("TikTok: access forbidden.");
  if (res.status === 429) throw new Error("TikTok rate limit exceeded.");
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`TikTok HTTP ${res.status}: ${b || res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const errObj = json.error as Record<string, unknown> | undefined;
  if (errObj?.code && errObj.code !== "ok") {
    throw new Error(`TikTok API error: ${errObj.message ?? errObj.code}`);
  }
  return json;
}

// get_tiktok_user
export async function getTiktokUser(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const fields = "open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count";
    const json = await tiktokGet(token, "/user/info/", { fields }) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    return data?.user ?? json;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_tiktok_videos
export async function listTiktokVideos(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const fields = "id,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
    const body: Record<string, unknown> = {
      max_count: Number(args.max_count ?? 20),
    };
    if (args.cursor) body.cursor = Number(args.cursor);

    const json = await tiktokPost(token, "/video/list/", body, fields) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    const videos = (data?.videos ?? []) as Array<Record<string, unknown>>;
    return {
      count: videos.length,
      cursor: data?.cursor,
      has_more: data?.has_more,
      videos,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_tiktok_video
export async function getTiktokVideo(args: Record<string, unknown>): Promise<unknown> {
  try {
    const token = getToken(args);
    const videoId = String(args.video_id ?? "").trim();
    if (!videoId) return { error: "video_id is required." };

    const fields = "id,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";
    const body: Record<string, unknown> = {
      filters: { video_ids: [videoId] },
    };

    const json = await tiktokPost(token, "/video/query/", body, fields) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    const videos = (data?.videos ?? []) as Array<Record<string, unknown>>;
    return videos[0] ?? { error: "Video not found." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
