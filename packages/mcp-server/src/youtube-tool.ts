// YouTube Data API v3 integration for the UnClick MCP server.
// Uses the YouTube Data API via fetch - no external dependencies.
// Users must supply an API key from Google Cloud Console.

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YtPageInfo {
  totalResults: number;
  resultsPerPage: number;
}

interface YtSearchItem {
  kind: string;
  etag: string;
  id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    thumbnails: Record<string, { url: string; width: number; height: number }>;
    liveBroadcastContent: string;
  };
}

interface YtVideo {
  id: string;
  snippet?: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    tags?: string[];
    categoryId?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration: string;
    dimension: string;
    definition: string;
  };
}

interface YtChannel {
  id: string;
  snippet?: {
    title: string;
    description: string;
    customUrl?: string;
    publishedAt: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
  };
}

interface YtPlaylist {
  id: string;
  snippet?: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  contentDetails?: { itemCount: number };
}

interface YtPlaylistItem {
  id: string;
  snippet?: {
    title: string;
    description: string;
    channelId: string;
    videoOwnerChannelTitle?: string;
    position: number;
    resourceId: { kind: string; videoId: string };
    publishedAt: string;
  };
}

interface YtCaption {
  id: string;
  snippet: {
    videoId: string;
    lastUpdated: string;
    trackKind: string;
    language: string;
    name: string;
    audioTrackType: string;
    isCC: boolean;
    isLarge: boolean;
    isEasyReader: boolean;
    isDraft: boolean;
    isAutoSynced: boolean;
    status: string;
  };
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function ytGet<T>(apiKey: string, endpoint: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, key: apiKey }).toString();
  const res = await fetch(`${YT_API_BASE}/${endpoint}?${query}`);

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    const code = err?.code ? ` (code ${err.code})` : "";
    throw new Error(`YouTube API error${code}: ${msg}`);
  }
  return data as T;
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? "").trim();
  if (!key) throw new Error("api_key is required. Create one at console.cloud.google.com.");
  return key;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function youtubeSearch(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const q = String(args.query ?? "").trim();
  if (!q) throw new Error("query is required.");
  const maxResults = Math.min(50, Math.max(1, Number(args.max_results ?? 10)));
  const type = String(args.type ?? "video");

  const params: Record<string, string> = {
    part: "snippet",
    q,
    type,
    maxResults: String(maxResults),
  };
  if (args.order) params.order = String(args.order);
  if (args.published_after) params.publishedAfter = String(args.published_after);
  if (args.region_code) params.regionCode = String(args.region_code);
  if (args.page_token) params.pageToken = String(args.page_token);
  if (args.channel_id) params.channelId = String(args.channel_id);

  const data = await ytGet<{ items: YtSearchItem[]; nextPageToken?: string; pageInfo: YtPageInfo }>(
    apiKey, "search", params
  );

  return {
    total_results: data.pageInfo.totalResults,
    next_page_token: data.nextPageToken ?? null,
    items: (data.items ?? []).map((item) => ({
      kind: item.id.kind,
      id: item.id.videoId ?? item.id.channelId ?? item.id.playlistId,
      title: item.snippet.title,
      description: item.snippet.description,
      channel_id: item.snippet.channelId,
      channel_title: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
      live_broadcast: item.snippet.liveBroadcastContent,
    })),
  };
}

export async function youtubeGetVideo(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const videoId = String(args.video_id ?? "").trim();
  if (!videoId) throw new Error("video_id is required.");

  const data = await ytGet<{ items: YtVideo[] }>(apiKey, "videos", {
    part: "snippet,statistics,contentDetails",
    id: videoId,
  });

  const video = data.items?.[0];
  if (!video) throw new Error(`Video not found: ${videoId}`);

  return {
    id: video.id,
    title: video.snippet?.title ?? null,
    description: video.snippet?.description ?? null,
    channel_id: video.snippet?.channelId ?? null,
    channel_title: video.snippet?.channelTitle ?? null,
    published_at: video.snippet?.publishedAt ?? null,
    tags: video.snippet?.tags ?? [],
    duration: video.contentDetails?.duration ?? null,
    definition: video.contentDetails?.definition ?? null,
    view_count: video.statistics?.viewCount ?? null,
    like_count: video.statistics?.likeCount ?? null,
    comment_count: video.statistics?.commentCount ?? null,
  };
}

export async function youtubeGetChannel(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const channelId = String(args.channel_id ?? "").trim();
  const forHandle = String(args.handle ?? "").trim();
  if (!channelId && !forHandle) throw new Error("Either channel_id or handle is required.");

  const params: Record<string, string> = { part: "snippet,statistics" };
  if (channelId) params.id = channelId;
  if (forHandle) params.forHandle = forHandle.startsWith("@") ? forHandle.slice(1) : forHandle;

  const data = await ytGet<{ items: YtChannel[] }>(apiKey, "channels", params);
  const channel = data.items?.[0];
  if (!channel) throw new Error("Channel not found.");

  return {
    id: channel.id,
    title: channel.snippet?.title ?? null,
    description: channel.snippet?.description ?? null,
    custom_url: channel.snippet?.customUrl ?? null,
    published_at: channel.snippet?.publishedAt ?? null,
    subscriber_count: channel.statistics?.subscriberCount ?? null,
    video_count: channel.statistics?.videoCount ?? null,
    view_count: channel.statistics?.viewCount ?? null,
  };
}

export async function youtubeListPlaylists(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const channelId = String(args.channel_id ?? "").trim();
  if (!channelId) throw new Error("channel_id is required.");
  const maxResults = Math.min(50, Math.max(1, Number(args.max_results ?? 20)));

  const params: Record<string, string> = {
    part: "snippet,contentDetails",
    channelId,
    maxResults: String(maxResults),
  };
  if (args.page_token) params.pageToken = String(args.page_token);

  const data = await ytGet<{ items: YtPlaylist[]; nextPageToken?: string; pageInfo: YtPageInfo }>(
    apiKey, "playlists", params
  );

  return {
    total_results: data.pageInfo.totalResults,
    next_page_token: data.nextPageToken ?? null,
    playlists: (data.items ?? []).map((pl) => ({
      id: pl.id,
      title: pl.snippet?.title ?? null,
      description: pl.snippet?.description ?? null,
      channel_id: pl.snippet?.channelId ?? null,
      channel_title: pl.snippet?.channelTitle ?? null,
      published_at: pl.snippet?.publishedAt ?? null,
      item_count: pl.contentDetails?.itemCount ?? null,
    })),
  };
}

export async function youtubeListPlaylistItems(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const playlistId = String(args.playlist_id ?? "").trim();
  if (!playlistId) throw new Error("playlist_id is required.");
  const maxResults = Math.min(50, Math.max(1, Number(args.max_results ?? 20)));

  const params: Record<string, string> = {
    part: "snippet",
    playlistId,
    maxResults: String(maxResults),
  };
  if (args.page_token) params.pageToken = String(args.page_token);

  const data = await ytGet<{ items: YtPlaylistItem[]; nextPageToken?: string; pageInfo: YtPageInfo }>(
    apiKey, "playlistItems", params
  );

  return {
    total_results: data.pageInfo.totalResults,
    next_page_token: data.nextPageToken ?? null,
    items: (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet?.title ?? null,
      video_id: item.snippet?.resourceId.videoId ?? null,
      position: item.snippet?.position ?? null,
      published_at: item.snippet?.publishedAt ?? null,
    })),
  };
}

export async function youtubeGetCaptions(args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);
  const videoId = String(args.video_id ?? "").trim();
  if (!videoId) throw new Error("video_id is required.");

  const data = await ytGet<{ items: YtCaption[] }>(apiKey, "captions", {
    part: "snippet",
    videoId,
  });

  return {
    count: (data.items ?? []).length,
    captions: (data.items ?? []).map((c) => ({
      id: c.id,
      language: c.snippet.language,
      name: c.snippet.name,
      track_kind: c.snippet.trackKind,
      is_cc: c.snippet.isCC,
      is_auto_synced: c.snippet.isAutoSynced,
      status: c.snippet.status,
      last_updated: c.snippet.lastUpdated,
    })),
  };
}
