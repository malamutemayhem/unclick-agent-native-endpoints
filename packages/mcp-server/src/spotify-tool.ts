// Spotify Web API integration for the UnClick MCP server.
// Uses the Spotify Web API via fetch - no external dependencies.
// Users must supply a Bearer token (access token) from Spotify OAuth.

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpotifyImage { url: string; height: number | null; width: number | null }

interface SpotifyArtistSimple { id: string; name: string; external_urls: { spotify: string } }

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  explicit: boolean;
  popularity?: number;
  preview_url: string | null;
  track_number: number;
  artists: SpotifyArtistSimple[];
  album?: {
    id: string;
    name: string;
    release_date: string;
    images: SpotifyImage[];
    album_type: string;
  };
  external_urls: { spotify: string };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  images: SpotifyImage[];
  artists: SpotifyArtistSimple[];
  label?: string;
  popularity?: number;
  genres?: string[];
  external_urls: { spotify: string };
  tracks?: { items: SpotifyTrack[]; total: number };
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: { total: number };
  images: SpotifyImage[];
  external_urls: { spotify: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  public: boolean;
  followers: { total: number };
  owner: { id: string; display_name: string };
  tracks: { total: number; items?: Array<{ track: SpotifyTrack | null }> };
  images: SpotifyImage[];
  external_urls: { spotify: string };
}

interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  time_signature: number;
  duration_ms: number;
}

interface SpotifySearchResult {
  tracks?: { items: SpotifyTrack[]; total: number; next: string | null };
  albums?: { items: SpotifyAlbum[]; total: number; next: string | null };
  artists?: { items: SpotifyArtist[]; total: number; next: string | null };
  playlists?: { items: SpotifyPlaylist[]; total: number; next: string | null };
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function spotifyGet<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${SPOTIFY_API_BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as Record<string, unknown> | undefined;
    const msg = (err?.message as string) ?? `HTTP ${res.status}`;
    const status = err?.status ? ` (${err.status})` : "";
    throw new Error(`Spotify API error${status}: ${msg}`);
  }
  return data as T;
}

// ─── Auth validation ──────────────────────────────────────────────────────────

function requireToken(args: Record<string, unknown>): string {
  const token = String(args.bearer_token ?? "").trim();
  if (!token) throw new Error("bearer_token is required. Obtain one via Spotify OAuth at developer.spotify.com.");
  return token;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function spotifySearch(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const q = String(args.query ?? "").trim();
  if (!q) throw new Error("query is required.");
  const type = String(args.type ?? "track");
  const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
  const offset = Math.max(0, Number(args.offset ?? 0));
  const market = args.market ? String(args.market) : undefined;

  const validTypes = ["track", "album", "artist", "playlist", "show", "episode"];
  const requestedTypes = type.split(",").map((t) => t.trim());
  const invalid = requestedTypes.filter((t) => !validTypes.includes(t));
  if (invalid.length > 0) {
    throw new Error(`Invalid type(s): ${invalid.join(", ")}. Valid: ${validTypes.join(", ")}.`);
  }

  const params: Record<string, string> = { q, type, limit: String(limit), offset: String(offset) };
  if (market) params.market = market;

  const data = await spotifyGet<SpotifySearchResult>(token, "/search", params);

  const result: Record<string, unknown> = {};
  if (data.tracks) {
    result.tracks = {
      total: data.tracks.total,
      next: data.tracks.next,
      items: data.tracks.items.map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        album: t.album?.name,
        duration_ms: t.duration_ms,
        popularity: t.popularity,
        preview_url: t.preview_url,
        spotify_url: t.external_urls.spotify,
      })),
    };
  }
  if (data.albums) {
    result.albums = {
      total: data.albums.total,
      next: data.albums.next,
      items: data.albums.items.map((a) => ({
        id: a.id,
        name: a.name,
        artists: a.artists.map((ar) => ar.name),
        release_date: a.release_date,
        total_tracks: a.total_tracks,
        spotify_url: a.external_urls.spotify,
      })),
    };
  }
  if (data.artists) {
    result.artists = {
      total: data.artists.total,
      next: data.artists.next,
      items: data.artists.items.map((a) => ({
        id: a.id,
        name: a.name,
        genres: a.genres,
        popularity: a.popularity,
        followers: a.followers.total,
        spotify_url: a.external_urls.spotify,
      })),
    };
  }
  if (data.playlists) {
    result.playlists = {
      total: data.playlists.total,
      next: data.playlists.next,
      items: data.playlists.items.map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.owner.display_name,
        tracks_total: p.tracks.total,
        spotify_url: p.external_urls.spotify,
      })),
    };
  }
  return result;
}

export async function spotifyGetTrack(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const trackId = String(args.track_id ?? "").trim();
  if (!trackId) throw new Error("track_id is required.");

  const params: Record<string, string> = {};
  if (args.market) params.market = String(args.market);

  const track = await spotifyGet<SpotifyTrack>(token, `/tracks/${encodeURIComponent(trackId)}`, params);
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
    album: track.album ? {
      id: track.album.id,
      name: track.album.name,
      release_date: track.album.release_date,
      type: track.album.album_type,
    } : null,
    duration_ms: track.duration_ms,
    explicit: track.explicit,
    popularity: track.popularity,
    preview_url: track.preview_url,
    track_number: track.track_number,
    spotify_url: track.external_urls.spotify,
  };
}

export async function spotifyGetAlbum(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const albumId = String(args.album_id ?? "").trim();
  if (!albumId) throw new Error("album_id is required.");

  const album = await spotifyGet<SpotifyAlbum>(token, `/albums/${encodeURIComponent(albumId)}`);
  return {
    id: album.id,
    name: album.name,
    type: album.album_type,
    release_date: album.release_date,
    total_tracks: album.total_tracks,
    artists: album.artists.map((a) => ({ id: a.id, name: a.name })),
    label: album.label ?? null,
    popularity: album.popularity ?? null,
    genres: album.genres ?? [],
    image: album.images[0]?.url ?? null,
    spotify_url: album.external_urls.spotify,
    tracks: album.tracks?.items.map((t) => ({
      id: t.id,
      name: t.name,
      duration_ms: t.duration_ms,
      track_number: t.track_number,
    })) ?? [],
  };
}

export async function spotifyGetArtist(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const artistId = String(args.artist_id ?? "").trim();
  if (!artistId) throw new Error("artist_id is required.");

  const artist = await spotifyGet<SpotifyArtist>(token, `/artists/${encodeURIComponent(artistId)}`);
  return {
    id: artist.id,
    name: artist.name,
    genres: artist.genres,
    popularity: artist.popularity,
    followers: artist.followers.total,
    image: artist.images[0]?.url ?? null,
    spotify_url: artist.external_urls.spotify,
  };
}

export async function spotifyGetPlaylist(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const playlistId = String(args.playlist_id ?? "").trim();
  if (!playlistId) throw new Error("playlist_id is required.");

  const params: Record<string, string> = {};
  if (args.market) params.market = String(args.market);

  const pl = await spotifyGet<SpotifyPlaylist>(token, `/playlists/${encodeURIComponent(playlistId)}`, params);
  return {
    id: pl.id,
    name: pl.name,
    description: pl.description,
    public: pl.public,
    owner: pl.owner.display_name,
    followers: pl.followers.total,
    total_tracks: pl.tracks.total,
    image: pl.images[0]?.url ?? null,
    spotify_url: pl.external_urls.spotify,
    tracks: (pl.tracks.items ?? [])
      .filter((item) => item.track !== null)
      .map((item) => ({
        id: item.track!.id,
        name: item.track!.name,
        artists: item.track!.artists.map((a) => a.name),
        duration_ms: item.track!.duration_ms,
      })),
  };
}

export async function spotifyGetRecommendations(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)));

  const params: Record<string, string> = { limit: String(limit) };

  // At least one seed is required
  const seedTracks = String(args.seed_tracks ?? "").trim();
  const seedArtists = String(args.seed_artists ?? "").trim();
  const seedGenres = String(args.seed_genres ?? "").trim();

  if (!seedTracks && !seedArtists && !seedGenres) {
    throw new Error("At least one of seed_tracks, seed_artists, or seed_genres is required.");
  }

  if (seedTracks) params.seed_tracks = seedTracks;
  if (seedArtists) params.seed_artists = seedArtists;
  if (seedGenres) params.seed_genres = seedGenres;
  if (args.market) params.market = String(args.market);
  if (args.min_energy !== undefined) params.min_energy = String(args.min_energy);
  if (args.max_energy !== undefined) params.max_energy = String(args.max_energy);
  if (args.min_tempo !== undefined) params.min_tempo = String(args.min_tempo);
  if (args.max_tempo !== undefined) params.max_tempo = String(args.max_tempo);
  if (args.target_valence !== undefined) params.target_valence = String(args.target_valence);
  if (args.target_danceability !== undefined) params.target_danceability = String(args.target_danceability);

  const data = await spotifyGet<{ tracks: SpotifyTrack[] }>(token, "/recommendations", params);
  return {
    count: data.tracks.length,
    tracks: data.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name),
      album: t.album?.name ?? null,
      duration_ms: t.duration_ms,
      popularity: t.popularity,
      preview_url: t.preview_url,
      spotify_url: t.external_urls.spotify,
    })),
  };
}

export async function spotifyGetAudioFeatures(args: Record<string, unknown>): Promise<unknown> {
  const token = requireToken(args);
  const trackId = String(args.track_id ?? "").trim();
  if (!trackId) throw new Error("track_id is required.");

  const features = await spotifyGet<SpotifyAudioFeatures>(token, `/audio-features/${encodeURIComponent(trackId)}`);
  return {
    id: features.id,
    danceability: features.danceability,
    energy: features.energy,
    key: features.key,
    loudness: features.loudness,
    mode: features.mode,
    speechiness: features.speechiness,
    acousticness: features.acousticness,
    instrumentalness: features.instrumentalness,
    liveness: features.liveness,
    valence: features.valence,
    tempo: features.tempo,
    time_signature: features.time_signature,
    duration_ms: features.duration_ms,
  };
}
