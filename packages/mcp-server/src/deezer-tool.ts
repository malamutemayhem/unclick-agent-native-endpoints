// Deezer music API.
// No API key required for basic search (public endpoints).
// Base URL: https://api.deezer.com/

const DEEZER_BASE = "https://api.deezer.com";

async function deezerFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${DEEZER_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`Deezer API HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  rank?: number;
  preview?: string;
  link?: string;
  artist?: { id: number; name: string; picture?: string; link?: string };
  album?: { id: number; title: string; cover?: string };
}

interface DeezerArtist {
  id: number;
  name: string;
  nb_fan?: number;
  nb_album?: number;
  picture?: string;
  picture_medium?: string;
  link?: string;
  radio?: boolean;
}

interface DeezerAlbum {
  id: number;
  title: string;
  release_date?: string;
  nb_tracks?: number;
  duration?: number;
  fans?: number;
  cover?: string;
  cover_medium?: string;
  link?: string;
  artist?: DeezerArtist;
  tracks?: { data: DeezerTrack[] };
  genres?: { data: Array<{ id: number; name: string }> };
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
  next?: string;
}

function normalizeTrack(t: DeezerTrack) {
  return {
    id: t.id,
    title: t.title,
    duration_seconds: t.duration,
    duration_formatted: formatDuration(t.duration),
    rank: t.rank ?? null,
    preview_url: t.preview ?? null,
    link: t.link ?? null,
    artist: t.artist ? { id: t.artist.id, name: t.artist.name, link: t.artist.link ?? null } : null,
    album: t.album ? { id: t.album.id, title: t.album.title, cover: t.album.cover ?? null } : null,
  };
}

// ─── search_deezer ────────────────────────────────────────────────────────────

export async function searchDeezer(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
  const data = await deezerFetch<DeezerSearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);

  return {
    query,
    total: data.total,
    returned: data.data.length,
    tracks: data.data.map(normalizeTrack),
  };
}

// ─── get_deezer_artist ────────────────────────────────────────────────────────

export async function getDeezerArtist(args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (Deezer artist ID)." };

  const artist = await deezerFetch<DeezerArtist>(`/artist/${encodeURIComponent(id)}`);

  return {
    id: artist.id,
    name: artist.name,
    fans: artist.nb_fan ?? null,
    album_count: artist.nb_album ?? null,
    picture: artist.picture_medium ?? artist.picture ?? null,
    link: artist.link ?? null,
    has_radio: artist.radio ?? null,
  };
}

// ─── get_deezer_album ─────────────────────────────────────────────────────────

export async function getDeezerAlbum(args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (Deezer album ID)." };

  const album = await deezerFetch<DeezerAlbum>(`/album/${encodeURIComponent(id)}`);

  return {
    id: album.id,
    title: album.title,
    artist: album.artist ? { id: album.artist.id, name: album.artist.name } : null,
    release_date: album.release_date ?? null,
    track_count: album.nb_tracks ?? null,
    duration_seconds: album.duration ?? null,
    duration_formatted: album.duration ? formatDuration(album.duration) : null,
    fans: album.fans ?? null,
    cover: album.cover_medium ?? album.cover ?? null,
    link: album.link ?? null,
    genres: album.genres?.data.map((g) => g.name) ?? [],
    tracklist: album.tracks?.data.map((t) => ({
      id: t.id,
      title: t.title,
      duration_seconds: t.duration,
      duration_formatted: formatDuration(t.duration),
      preview_url: t.preview ?? null,
    })) ?? [],
  };
}

// ─── get_deezer_track ─────────────────────────────────────────────────────────

export async function getDeezerTrack(args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (Deezer track ID)." };

  interface FullTrack extends DeezerTrack {
    bpm?: number;
    gain?: number;
    isrc?: string;
    available_countries?: string[];
  }

  const track = await deezerFetch<FullTrack>(`/track/${encodeURIComponent(id)}`);

  return {
    ...normalizeTrack(track),
    bpm: track.bpm ?? null,
    isrc: track.isrc ?? null,
    available_countries: track.available_countries ?? null,
    note: track.preview ? "preview_url is a 30-second MP3 sample, freely accessible." : "No preview available for this track.",
  };
}

// ─── get_deezer_chart ─────────────────────────────────────────────────────────

interface DeezerChartResponse {
  tracks: { data: DeezerTrack[] };
}

export async function getDeezerChart(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
  const data = await deezerFetch<DeezerChartResponse>(`/chart/0/tracks?limit=${limit}`);

  return {
    chart: "Global Top Tracks",
    count: data.tracks.data.length,
    tracks: data.tracks.data.map((t, i) => ({
      ...normalizeTrack(t),
      rank: i + 1,
    })),
  };
}

// ─── search_deezer_playlist ───────────────────────────────────────────────────

interface DeezerPlaylist {
  id: number;
  title: string;
  nb_tracks?: number;
  duration?: number;
  fans?: number;
  public?: boolean;
  picture?: string;
  picture_medium?: string;
  link?: string;
  user?: { id: number; name: string };
}

interface DeezerPlaylistSearchResponse {
  data: DeezerPlaylist[];
  total: number;
}

export async function searchDeezerPlaylist(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const limit = Math.min(25, Math.max(1, Number(args.limit ?? 10)));
  const data = await deezerFetch<DeezerPlaylistSearchResponse>(`/search/playlist?q=${encodeURIComponent(query)}&limit=${limit}`);

  return {
    query,
    total: data.total,
    returned: data.data.length,
    playlists: data.data.map((p) => ({
      id: p.id,
      title: p.title,
      track_count: p.nb_tracks ?? null,
      duration_seconds: p.duration ?? null,
      duration_formatted: p.duration ? formatDuration(p.duration) : null,
      fans: p.fans ?? null,
      public: p.public ?? null,
      cover: p.picture_medium ?? p.picture ?? null,
      link: p.link ?? null,
      created_by: p.user ? { id: p.user.id, name: p.user.name } : null,
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
