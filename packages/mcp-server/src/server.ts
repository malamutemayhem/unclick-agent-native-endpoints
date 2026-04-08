import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CATALOG, TOOL_MAP, ENDPOINT_MAP, type ToolDef } from "./catalog.js";
import { createClient, type UnClickClient } from "./client.js";
import { abnLookup, abnSearch } from "./abn-tool.js";
import { stockQuote, stockSearch, stockDaily, stockIntraday, forexRate, cryptoDaily } from "./alphavantage-tool.js";
import { bandsintownArtist, bandsintownEvents, bandsintownRecommended } from "./bandsintown-tool.js";
import { chessPlayer, chessPlayerStats, chessPlayerGames, chessPuzzlesRandom, chessLeaderboards } from "./chessdotcom-tool.js";
import { cryptoPrice, cryptoCoin, cryptoSearch, cryptoTrending, cryptoTopCoins, cryptoCoinHistory } from "./coingecko-tool.js";
import { cmcListings, cmcQuotes, cmcInfo, cmcTrending, cmcGlobalMetrics } from "./coinmarketcap-tool.js";
import { discogsSearchReleases, discogsGetRelease, discogsGetArtist, discogsSearchArtists, discogsGetMarketplaceStats, discogsGetLabel } from "./discogs-tool.js";
import { eventbriteSearchEvents, eventbriteGetEvent, eventbriteGetEventAttendees, eventbriteCreateEvent, eventbriteListCategories, eventbriteGetVenue } from "./eventbrite-tool.js";
import { foursquareSearchPlaces, foursquareGetPlace, foursquareGetPhotos, foursquareGetTips, foursquareAutocomplete } from "./foursquare-tool.js";
import { fplBootstrap, fplPlayer, fplGameweek, fplFixtures, fplMyTeam, fplManager, fplLeaguesClassic } from "./fpl-tool.js";
import { geniusSearch, geniusGetSong, geniusGetArtist, geniusArtistSongs } from "./genius-tool.js";
import { guardianSearchArticles, guardianGetArticle, guardianGetSections, guardianGetTags, guardianGetEdition } from "./guardian-tool.js";
import { hnTopStories, hnNewStories, hnBestStories, hnAskHn, hnShowHn, hnItem, hnUser } from "./hackernews-tool.js";
import { ipLookup, ipBatch } from "./ipapi-tool.js";
import { lastfmGetArtistInfo, lastfmSearchArtists, lastfmGetTopTracks, lastfmGetSimilarArtists, lastfmGetChartTopArtists, lastfmGetChartTopTracks, lastfmGetAlbumInfo } from "./lastfm-tool.js";
import { lichessUser, lichessUserGames, lichessPuzzleDaily, lichessTopPlayers, lichessTournament } from "./lichess-tool.js";
import { mbSearchArtists, mbSearchReleases, mbSearchRecordings, mbGetArtist, mbGetRelease } from "./musicbrainz-tool.js";
import { nasaApod, nasaAsteroids, nasaMarsPhotos, nasaEarthImagery, nasaEpic } from "./nasa-tool.js";
import { newsGetTopHeadlines, newsSearchNews, newsGetSources } from "./newsapi-tool.js";
import { numberFact, numberRandom } from "./numbers-tool.js";
import { omdbSearch, omdbGetByTitle, omdbGetById } from "./omdb-tool.js";
import { forexLatest, forexHistorical, forexCurrencies, forexConvert } from "./openexchangerates-tool.js";
import { f1Sessions, f1Drivers, f1Positions, f1Laps, f1PitStops, f1CarData, f1TeamRadio, f1Weather } from "./openf1-tool.js";
import { openlibrarySearch, openlibraryGetBook, openlibraryGetEdition, openlibraryGetAuthor, openlibraryAuthorWorks, openlibraryTrending } from "./openlibrary-tool.js";
import { weatherCurrent, weatherForecast, weatherHourly } from "./openmeteo-tool.js";
import { podcastSearch, podcastGetByFeedUrl, podcastGetEpisodes, podcastSearchEpisodes, podcastTrending, podcastRecentEpisodes } from "./podcastindex-tool.js";
import { ptvSearch, ptvDepartures, ptvDisruptions, ptvStopsOnRoute, ptvRouteDirections } from "./ptv-tool.js";
import { radioSearch, radioByCountry, radioTopClicked, radioTopVoted, radioByTag, radioCountries } from "./radiobrowser-tool.js";
import { countryAll, countryByName, countryByCode, countryByRegion, countryByCurrency, countryByLanguage } from "./restcountries-tool.js";
import { seatgeekSearchEvents, seatgeekGetEvent, seatgeekSearchPerformers, seatgeekGetPerformer, seatgeekSearchVenues, seatgeekGetVenue } from "./seatgeek-tool.js";
import { setlistfmSearchArtist, setlistfmArtistSetlists, setlistfmSearchSetlists, setlistfmGetSetlist } from "./setlistfm-tool.js";
import { tmSearchEvents, tmGetEvent, tmSearchVenues, tmGetVenue, tmSearchAttractions } from "./ticketmaster-tool.js";
import { tmdbSearchMovies, tmdbSearchTv, tmdbMovie, tmdbTv, tmdbTrending, tmdbNowPlaying, tmdbUpcoming, tmdbPopularTv } from "./tmdb-tool.js";
import { tomorrowRealtime, tomorrowForecast, tomorrowHistory } from "./tomorrowio-tool.js";
import { triviaQuestions, triviaCategories } from "./trivia-tool.js";
import { twitchSearchStreams, twitchGetStream, twitchSearchGames, twitchGetTopGames, twitchGetClips, twitchGetChannelInfo, twitchGetSchedule } from "./twitch-tool.js";
import { wiseExchangeRates, wiseProfile, wiseAccounts, wiseCreateQuote } from "./wise-tool.js";
import { yelpSearchBusinesses, yelpGetBusiness, yelpGetReviews, yelpSearchEvents, yelpGetAutocomplete } from "./yelp-tool.js";

// ─── Search helper ──────────────────────────────────────────────────────────

function searchTools(query: string, category?: string): ToolDef[] {
  const q = query.toLowerCase();
  return CATALOG.filter((tool) => {
    const categoryMatch = !category || tool.category === category;
    if (!categoryMatch) return false;
    if (!q) return true;

    const inToolName = tool.name.toLowerCase().includes(q);
    const inToolDesc = tool.description.toLowerCase().includes(q);
    const inSlug = tool.slug.toLowerCase().includes(q);
    const inEndpoints = tool.endpoints.some(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
    );
    return inToolName || inToolDesc || inSlug || inEndpoints;
  });
}

function formatToolSummary(tool: ToolDef): string {
  return [
    `**${tool.name}** (slug: \`${tool.slug}\`, category: ${tool.category})`,
    tool.description,
    `Endpoints: ${tool.endpoints.map((e) => `\`${e.id}\``).join(", ")}`,
  ].join("\n");
}

// ─── MCP Tool definitions ───────────────────────────────────────────────────

const META_TOOLS = [
  {
    name: "unclick_search",
    description:
      "Search the UnClick tool marketplace by keyword or description. " +
      "Use this to discover which tools are available for a task. " +
      "Example: 'I need to resize an image' → returns the image tool with its endpoints.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term — describe what you want to do",
        },
        category: {
          type: "string",
          enum: ["text", "data", "media", "time", "network", "generation", "storage", "platform"],
          description: "Optional: filter by category",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "unclick_browse",
    description:
      "Browse all available UnClick tools, optionally filtered by category. " +
      "Returns a list of tools with their slugs and descriptions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["text", "data", "media", "time", "network", "generation", "storage", "platform"],
          description: "Optional: filter to a specific category",
        },
      },
    },
  },
  {
    name: "unclick_tool_info",
    description:
      "Get detailed information about a specific UnClick tool including all its endpoints, " +
      "required parameters, and response shapes. Use this after unclick_search to understand " +
      "exactly how to call a tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description:
            "Tool slug, e.g. 'image', 'hash', 'csv', 'cron'. " +
            "Available slugs: " + CATALOG.map((t) => t.slug).join(", "),
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "unclick_call",
    description:
      "Call any UnClick tool endpoint. Specify the endpoint ID and parameters. " +
      "Use unclick_search or unclick_tool_info to discover endpoint IDs and required params. " +
      "Example: endpoint_id='image.resize', params={image: '<base64>', width: 800, height: 600}",
    inputSchema: {
      type: "object" as const,
      properties: {
        endpoint_id: {
          type: "string",
          description:
            "Endpoint identifier, e.g. 'image.resize', 'hash.compute', 'csv.parse', 'cron.next'",
        },
        params: {
          type: "object",
          description: "Parameters for the endpoint. Use unclick_tool_info to see required params.",
        },
      },
      required: ["endpoint_id", "params"],
    },
  },
] as const;

const DIRECT_TOOLS = [
  {
    name: "unclick_shorten_url",
    description: "Shorten a URL using UnClick. Returns a short URL and its code.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to shorten" },
      },
      required: ["url"],
    },
  },
  {
    name: "unclick_generate_qr",
    description: "Generate a QR code from text or a URL. Returns base64-encoded PNG or SVG.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Text or URL to encode in the QR code" },
        format: { type: "string", enum: ["png", "svg"], default: "png" },
        size: { type: "number", description: "Image size in pixels (100–1000)", default: 300 },
      },
      required: ["text"],
    },
  },
  {
    name: "unclick_hash",
    description: "Compute a cryptographic hash (MD5, SHA1, SHA256, SHA512) of text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        algorithm: {
          type: "string",
          enum: ["md5", "sha1", "sha256", "sha512"],
          default: "sha256",
        },
      },
      required: ["text", "algorithm"],
    },
  },
  {
    name: "unclick_transform_text",
    description:
      "Transform text case: upper, lower, title, sentence, camelCase, snake_case, kebab-case, PascalCase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        to: {
          type: "string",
          enum: ["upper", "lower", "title", "sentence", "camel", "snake", "kebab", "pascal"],
        },
      },
      required: ["text", "to"],
    },
  },
  {
    name: "unclick_validate_email",
    description: "Validate an email address format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "unclick_validate_url",
    description: "Validate a URL format, optionally check if it's reachable.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        check_reachable: { type: "boolean", default: false },
      },
      required: ["url"],
    },
  },
  {
    name: "unclick_resize_image",
    description: "Resize an image (provided as base64) to specified dimensions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        image: { type: "string", description: "Base64-encoded image (with or without data: prefix)" },
        width: { type: "number" },
        height: { type: "number" },
        fit: {
          type: "string",
          enum: ["cover", "contain", "fill", "inside", "outside"],
          default: "cover",
        },
      },
      required: ["image", "width", "height"],
    },
  },
  {
    name: "unclick_parse_csv",
    description: "Parse a CSV string into a JSON array of rows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        csv: { type: "string" },
        header: { type: "boolean", default: true },
        delimiter: { type: "string", default: "," },
      },
      required: ["csv"],
    },
  },
  {
    name: "unclick_json_format",
    description: "Format / pretty-print a JSON string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: { type: "string" },
        indent: { description: "2, 4, or 'tab'", default: 2 },
      },
      required: ["json"],
    },
  },
  {
    name: "unclick_encode",
    description: "Encode or decode text. Supports base64, URL, HTML, and hex.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        operation: {
          type: "string",
          enum: [
            "encode_base64", "decode_base64",
            "encode_url", "decode_url",
            "encode_html", "decode_html",
            "encode_hex", "decode_hex",
          ],
        },
      },
      required: ["text", "operation"],
    },
  },
  {
    name: "unclick_generate_uuid",
    description: "Generate one or more random UUIDs (v4).",
    inputSchema: {
      type: "object" as const,
      properties: {
        count: { type: "number", minimum: 1, maximum: 100, default: 1 },
      },
    },
  },
  {
    name: "unclick_random_password",
    description: "Generate a secure random password.",
    inputSchema: {
      type: "object" as const,
      properties: {
        length: { type: "number", minimum: 4, maximum: 512, default: 16 },
        uppercase: { type: "boolean", default: true },
        lowercase: { type: "boolean", default: true },
        numbers: { type: "boolean", default: true },
        symbols: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "unclick_cron_parse",
    description: "Convert a cron expression to a human-readable description and get next occurrences.",
    inputSchema: {
      type: "object" as const,
      properties: {
        expression: { type: "string", description: "e.g. '0 9 * * 1-5' (weekdays at 9am)" },
        next_count: { type: "number", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["expression"],
    },
  },
  {
    name: "unclick_ip_parse",
    description: "Parse an IP address — get decimal, binary, hex, and type (private/loopback/multicast).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "unclick_color_convert",
    description: "Convert a color between hex, RGB, HSL, and HSV formats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        color: {
          description: "Color as hex string (e.g. '#ff6b6b'), RGB object {r,g,b}, or HSL object {h,s,l}",
        },
      },
      required: ["color"],
    },
  },
  {
    name: "unclick_regex_test",
    description: "Test a regex pattern against text and get all matches with groups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex pattern (no surrounding slashes)" },
        flags: { type: "string", description: "Flags like 'gi'", default: "" },
        input: { type: "string" },
      },
      required: ["pattern", "input"],
    },
  },
  {
    name: "unclick_timestamp_convert",
    description: "Convert a timestamp (ISO, Unix seconds, or Unix ms) to all common formats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timestamp: {
          description: "ISO string, Unix seconds (e.g. 1700000000), or Unix ms (e.g. 1700000000000)",
        },
      },
      required: ["timestamp"],
    },
  },
  {
    name: "unclick_diff_text",
    description: "Compare two strings and return a unified diff showing what changed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        a: { type: "string", description: "Original text" },
        b: { type: "string", description: "New text" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "unclick_kv_set",
    description: "Store a value in the UnClick key-value store with optional TTL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        value: { description: "Any JSON-serializable value" },
        ttl: { type: "number", description: "Seconds until expiry (optional)" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "unclick_kv_get",
    description: "Retrieve a value from the UnClick key-value store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
      },
      required: ["key"],
    },
  },
  {
    name: "report_bug",
    description:
      "Report a bug or unexpected behavior encountered while using an UnClick tool. " +
      "Call this whenever a tool returns an error, behaves unexpectedly, or fails silently. " +
      "Severity is auto-classified from the error message: 500/fatal → critical, " +
      "timeout/503 → high, 4xx/invalid → low, everything else → medium.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tool_name: {
          type: "string",
          description: "Name or slug of the UnClick tool that failed (e.g. 'image', 'hash', 'uuid')",
        },
        error_message: {
          type: "string",
          description: "The error message or unexpected output received",
        },
        request_payload: {
          type: "object",
          description: "The request parameters sent to the tool (optional)",
        },
        expected_behavior: {
          type: "string",
          description: "What the tool should have done instead (optional)",
        },
        agent_context: {
          type: "string",
          description: "Brief description of what the agent was trying to accomplish (optional)",
        },
      },
      required: ["tool_name", "error_message"],
    },
  },
  // ─── ABN (Australian Business Registry) ───────────────────────────────────
  {
    name: "abn_lookup",
    description: "Look up Australian business details by ABN (11-digit Australian Business Number).",
    inputSchema: {
      type: "object" as const,
      properties: {
        abn: { type: "string", description: "11-digit Australian Business Number" },
      },
      required: ["abn"],
    },
  },
  {
    name: "abn_search",
    description: "Search for Australian businesses by name. Returns matching ABNs and entity details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Business name to search for" },
        postcode: { type: "string", description: "Optional postcode filter" },
      },
      required: ["name"],
    },
  },
  // ─── Alpha Vantage ─────────────────────────────────────────────────────────
  {
    name: "stock_quote",
    description: "Get a real-time stock quote from Alpha Vantage. Requires ALPHAVANTAGE_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol, e.g. AAPL" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "stock_search",
    description: "Search for stock symbols by keyword using Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keywords: { type: "string", description: "Search keywords, e.g. 'Apple'" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "stock_daily",
    description: "Get daily historical price data for a stock using Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol" },
        outputsize: { type: "string", description: "compact (last 100 days) or full", enum: ["compact", "full"] },
      },
      required: ["symbol"],
    },
  },
  {
    name: "stock_intraday",
    description: "Get intraday OHLCV data for a stock using Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol" },
        interval: { type: "string", description: "1min, 5min, 15min, 30min, or 60min", enum: ["1min", "5min", "15min", "30min", "60min"] },
      },
      required: ["symbol"],
    },
  },
  {
    name: "forex_rate",
    description: "Get real-time forex exchange rate between two currencies using Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_currency: { type: "string", description: "Source currency code, e.g. USD" },
        to_currency: { type: "string", description: "Target currency code, e.g. EUR" },
      },
      required: ["from_currency", "to_currency"],
    },
  },
  {
    name: "crypto_daily",
    description: "Get daily historical price data for a cryptocurrency using Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Crypto symbol, e.g. BTC" },
        market: { type: "string", description: "Market currency, e.g. USD" },
      },
      required: ["symbol", "market"],
    },
  },
  // ─── Bandsintown ───────────────────────────────────────────────────────────
  {
    name: "bandsintown_artist",
    description: "Get artist information from Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist_name: { type: "string", description: "Artist name" },
        app_id: { type: "string", description: "Optional Bandsintown app_id (defaults to env or 'unclick')" },
      },
      required: ["artist_name"],
    },
  },
  {
    name: "bandsintown_events",
    description: "Get upcoming events for an artist from Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist_name: { type: "string", description: "Artist name" },
        date: { type: "string", description: "Optional date filter, e.g. '2024-01-01,2024-12-31'" },
        app_id: { type: "string", description: "Optional Bandsintown app_id" },
      },
      required: ["artist_name"],
    },
  },
  {
    name: "bandsintown_recommended",
    description: "Get recommended events based on an artist and location from Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist_name: { type: "string", description: "Artist name" },
        location: { type: "string", description: "Location e.g. 'Austin,TX' or '33.74,-84.39'" },
        app_id: { type: "string", description: "Optional Bandsintown app_id" },
      },
      required: ["artist_name", "location"],
    },
  },
  // ─── Chess.com ─────────────────────────────────────────────────────────────
  {
    name: "chess_player",
    description: "Get a Chess.com player's profile information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username" },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_stats",
    description: "Get a Chess.com player's ratings and game statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username" },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_games",
    description: "Get a Chess.com player's games for a specific month.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Chess.com username" },
        year: { type: "string", description: "Year, e.g. 2024" },
        month: { type: "string", description: "Month number, e.g. 1 for January" },
      },
      required: ["username", "year", "month"],
    },
  },
  {
    name: "chess_puzzles_random",
    description: "Get a random chess puzzle from Chess.com.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "chess_leaderboards",
    description: "Get Chess.com leaderboards. Optionally filter by game type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_type: { type: "string", description: "Optional game type: live_rapid, live_blitz, live_bullet, daily, tactics, etc." },
      },
    },
  },
  // ─── CoinGecko ─────────────────────────────────────────────────────────────
  {
    name: "crypto_price",
    description: "Get current prices for one or more cryptocurrencies from CoinGecko. Free, no API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: { type: "string", description: "Comma-separated coin IDs, e.g. 'bitcoin,ethereum'" },
        vs_currencies: { type: "string", description: "Comma-separated target currencies, e.g. 'usd,eur'" },
      },
      required: ["ids"],
    },
  },
  {
    name: "crypto_coin",
    description: "Get detailed data for a cryptocurrency from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "CoinGecko coin ID, e.g. 'bitcoin'" },
      },
      required: ["id"],
    },
  },
  {
    name: "crypto_search",
    description: "Search for cryptocurrencies on CoinGecko by name or symbol.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "crypto_trending",
    description: "Get trending cryptocurrencies from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "crypto_top_coins",
    description: "Get top cryptocurrencies by market cap from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        vs_currency: { type: "string", description: "Target currency, e.g. usd" },
        order: { type: "string", description: "Sort order, e.g. market_cap_desc" },
        per_page: { type: "number", description: "Number of results (1-250)" },
        page: { type: "number", description: "Page number" },
      },
    },
  },
  {
    name: "crypto_coin_history",
    description: "Get historical data for a cryptocurrency on a specific date from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "CoinGecko coin ID, e.g. 'bitcoin'" },
        date: { type: "string", description: "Date in DD-MM-YYYY format" },
      },
      required: ["id", "date"],
    },
  },
  // ─── CoinMarketCap ─────────────────────────────────────────────────────────
  {
    name: "cmc_listings",
    description: "Get latest cryptocurrency listings from CoinMarketCap. Requires COINMARKETCAP_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of results (default 100, max 5000)" },
        convert: { type: "string", description: "Target currency, e.g. USD" },
      },
    },
  },
  {
    name: "cmc_quotes",
    description: "Get latest quotes for a cryptocurrency from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Coin symbol, e.g. BTC" },
        id: { type: "string", description: "CoinMarketCap ID (alternative to symbol)" },
      },
    },
  },
  {
    name: "cmc_info",
    description: "Get metadata for a cryptocurrency from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Coin symbol, e.g. BTC" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "cmc_trending",
    description: "Get trending cryptocurrencies from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of results (default 10, max 200)" },
      },
    },
  },
  {
    name: "cmc_global_metrics",
    description: "Get global cryptocurrency market metrics from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // ─── Discogs ───────────────────────────────────────────────────────────────
  {
    name: "discogs_search_releases",
    description: "Search music releases on Discogs. Requires DISCOGS_TOKEN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "General search query" },
        artist: { type: "string", description: "Artist name filter" },
        genre: { type: "string", description: "Genre filter" },
        year: { type: "number", description: "Release year filter" },
        format: { type: "string", description: "Format filter, e.g. Vinyl" },
        label: { type: "string", description: "Label filter" },
        per_page: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
    },
  },
  {
    name: "discogs_get_release",
    description: "Get a specific release from Discogs by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Discogs release ID" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
      required: ["id"],
    },
  },
  {
    name: "discogs_get_artist",
    description: "Get an artist from Discogs by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Discogs artist ID" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
      required: ["id"],
    },
  },
  {
    name: "discogs_search_artists",
    description: "Search for artists on Discogs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Artist name to search for" },
        per_page: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
      required: ["query"],
    },
  },
  {
    name: "discogs_get_marketplace_stats",
    description: "Get marketplace pricing stats for a release on Discogs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        release_id: { type: "string", description: "Discogs release ID" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
      required: ["release_id"],
    },
  },
  {
    name: "discogs_get_label",
    description: "Get a record label from Discogs by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Discogs label ID" },
        token: { type: "string", description: "Discogs personal access token (or set DISCOGS_TOKEN)" },
      },
      required: ["id"],
    },
  },
  // ─── Eventbrite ────────────────────────────────────────────────────────────
  {
    name: "eventbrite_search_events",
    description: "Search for events on Eventbrite. Requires EVENTBRITE_TOKEN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search query" },
        location_address: { type: "string", description: "Location address" },
        start_date_range_start: { type: "string", description: "Start date range start (ISO 8601)" },
        category_id: { type: "string", description: "Category ID" },
        sort_by: { type: "string", description: "Sort by field" },
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
    },
  },
  {
    name: "eventbrite_get_event",
    description: "Get details for an Eventbrite event by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Eventbrite event ID" },
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
      required: ["id"],
    },
  },
  {
    name: "eventbrite_get_event_attendees",
    description: "Get attendees for an Eventbrite event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Eventbrite event ID" },
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
      required: ["id"],
    },
  },
  {
    name: "eventbrite_create_event",
    description: "Create a new event on Eventbrite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        organization_id: { type: "string", description: "Eventbrite organization ID" },
        name: { type: "string", description: "Event name" },
        start: { type: "object", description: "Start time object with utc and timezone fields" },
        end: { type: "object", description: "End time object with utc and timezone fields" },
        currency: { type: "string", description: "Currency code, e.g. USD" },
        venue_id: { type: "string", description: "Optional venue ID" },
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
      required: ["organization_id", "name", "start", "end", "currency"],
    },
  },
  {
    name: "eventbrite_list_categories",
    description: "List all event categories on Eventbrite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
    },
  },
  {
    name: "eventbrite_get_venue",
    description: "Get details for an Eventbrite venue by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Eventbrite venue ID" },
        token: { type: "string", description: "Eventbrite token (or set EVENTBRITE_TOKEN)" },
      },
      required: ["id"],
    },
  },
  // ─── Foursquare ────────────────────────────────────────────────────────────
  {
    name: "foursquare_search_places",
    description: "Search for places using Foursquare Places API. Requires FOURSQUARE_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query, e.g. 'coffee'" },
        ll: { type: "string", description: "Latitude,longitude e.g. '40.7,-74.0'" },
        near: { type: "string", description: "Location string, e.g. 'New York, NY'" },
        categories: { type: "string", description: "Category IDs (comma-separated)" },
        limit: { type: "number", description: "Max results" },
        api_key: { type: "string", description: "Foursquare API key (or set FOURSQUARE_API_KEY)" },
      },
    },
  },
  {
    name: "foursquare_get_place",
    description: "Get details for a Foursquare place by its FSQ ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fsq_id: { type: "string", description: "Foursquare place ID" },
        api_key: { type: "string", description: "Foursquare API key (or set FOURSQUARE_API_KEY)" },
      },
      required: ["fsq_id"],
    },
  },
  {
    name: "foursquare_get_photos",
    description: "Get photos for a Foursquare place.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fsq_id: { type: "string", description: "Foursquare place ID" },
        api_key: { type: "string", description: "Foursquare API key (or set FOURSQUARE_API_KEY)" },
      },
      required: ["fsq_id"],
    },
  },
  {
    name: "foursquare_get_tips",
    description: "Get tips (reviews) for a Foursquare place.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fsq_id: { type: "string", description: "Foursquare place ID" },
        api_key: { type: "string", description: "Foursquare API key (or set FOURSQUARE_API_KEY)" },
      },
      required: ["fsq_id"],
    },
  },
  {
    name: "foursquare_autocomplete",
    description: "Autocomplete place names using Foursquare.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Partial text to autocomplete" },
        ll: { type: "string", description: "Optional latitude,longitude bias" },
        api_key: { type: "string", description: "Foursquare API key (or set FOURSQUARE_API_KEY)" },
      },
      required: ["query"],
    },
  },
  // ─── Fantasy Premier League ────────────────────────────────────────────────
  {
    name: "fpl_bootstrap",
    description: "Get FPL bootstrap data: all players, teams, and current gameweek info. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "fpl_player",
    description: "Get FPL player stats and upcoming fixtures by player element ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "FPL player element ID (from fpl_bootstrap)" },
      },
      required: ["id"],
    },
  },
  {
    name: "fpl_gameweek",
    description: "Get FPL live player scores for a gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gw: { type: "string", description: "Gameweek number" },
      },
      required: ["gw"],
    },
  },
  {
    name: "fpl_fixtures",
    description: "Get FPL fixtures, optionally for a specific gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gw: { type: "string", description: "Optional gameweek number" },
      },
    },
  },
  {
    name: "fpl_my_team",
    description: "Get an FPL manager's team picks for a specific gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_id: { type: "string", description: "FPL team/manager ID" },
        gw: { type: "string", description: "Gameweek number" },
      },
      required: ["team_id", "gw"],
    },
  },
  {
    name: "fpl_manager",
    description: "Get an FPL manager's overall stats and info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_id: { type: "string", description: "FPL team/manager ID" },
      },
      required: ["team_id"],
    },
  },
  {
    name: "fpl_leagues_classic",
    description: "Get standings for a classic FPL league.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "string", description: "FPL classic league ID" },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: ["league_id"],
    },
  },
  // ─── Genius ────────────────────────────────────────────────────────────────
  {
    name: "genius_search",
    description: "Search Genius for songs and lyrics. Requires GENIUS_ACCESS_TOKEN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search query" },
      },
      required: ["q"],
    },
  },
  {
    name: "genius_get_song",
    description: "Get details for a Genius song by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Genius song ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "genius_get_artist",
    description: "Get details for a Genius artist by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Genius artist ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "genius_artist_songs",
    description: "Get songs for a Genius artist by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Genius artist ID" },
        sort: { type: "string", description: "Sort order: title or popularity" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["id"],
    },
  },
  // ─── The Guardian ──────────────────────────────────────────────────────────
  {
    name: "guardian_search_articles",
    description: "Search The Guardian newspaper for articles. Requires GUARDIAN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        section: { type: "string", description: "Optional section filter" },
        from_date: { type: "string", description: "From date (YYYY-MM-DD)" },
        to_date: { type: "string", description: "To date (YYYY-MM-DD)" },
        order_by: { type: "string", description: "Sort: newest, oldest, relevance" },
        page_size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Guardian API key (or set GUARDIAN_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "guardian_get_article",
    description: "Get a specific Guardian article by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Article ID, e.g. 'world/2024/jan/01/article-slug'" },
        api_key: { type: "string", description: "Guardian API key (or set GUARDIAN_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "guardian_get_sections",
    description: "Get available sections from The Guardian.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Optional search filter" },
        api_key: { type: "string", description: "Guardian API key (or set GUARDIAN_API_KEY)" },
      },
    },
  },
  {
    name: "guardian_get_tags",
    description: "Search for tags in The Guardian.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Tag search query" },
        section: { type: "string", description: "Optional section filter" },
        type: { type: "string", description: "Optional tag type filter" },
        page_size: { type: "number", description: "Results per page" },
        api_key: { type: "string", description: "Guardian API key (or set GUARDIAN_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "guardian_get_edition",
    description: "Get a Guardian edition (uk, us, au).",
    inputSchema: {
      type: "object" as const,
      properties: {
        edition: { type: "string", description: "Edition code: uk, us, or au" },
        api_key: { type: "string", description: "Guardian API key (or set GUARDIAN_API_KEY)" },
      },
    },
  },
  // ─── Hacker News ───────────────────────────────────────────────────────────
  {
    name: "hn_top_stories",
    description: "Get top stories from Hacker News. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of stories to return (max 30)" },
      },
    },
  },
  {
    name: "hn_new_stories",
    description: "Get newest stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of stories to return (max 30)" },
      },
    },
  },
  {
    name: "hn_best_stories",
    description: "Get best stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of stories to return (max 30)" },
      },
    },
  },
  {
    name: "hn_ask_hn",
    description: "Get Ask HN stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of stories to return (max 30)" },
      },
    },
  },
  {
    name: "hn_show_hn",
    description: "Get Show HN stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of stories to return (max 30)" },
      },
    },
  },
  {
    name: "hn_item",
    description: "Get a specific Hacker News item (story, comment, etc.) by numeric ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Hacker News item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "hn_user",
    description: "Get a Hacker News user profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Hacker News username" },
      },
      required: ["username"],
    },
  },
  // ─── IP API ────────────────────────────────────────────────────────────────
  {
    name: "ip_lookup",
    description: "Look up geolocation and ISP info for an IP address. Free, no auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string", description: "IP address to look up. Leave empty to look up caller's IP." },
      },
    },
  },
  {
    name: "ip_batch",
    description: "Look up geolocation for multiple IP addresses in one request (max 100).",
    inputSchema: {
      type: "object" as const,
      properties: {
        addresses: { type: "array", description: "Array of IP address strings (max 100)", items: { type: "string" } },
      },
      required: ["addresses"],
    },
  },
  // ─── Last.fm ───────────────────────────────────────────────────────────────
  {
    name: "lastfm_get_artist_info",
    description: "Get artist info from Last.fm. Requires LASTFM_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string", description: "Artist name" },
        lang: { type: "string", description: "Language code for bio (e.g. en)" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_search_artists",
    description: "Search for artists on Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Artist name search query" },
        limit: { type: "number", description: "Max results" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "lastfm_get_top_tracks",
    description: "Get top tracks for an artist on Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string", description: "Artist name" },
        limit: { type: "number", description: "Max results" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_get_similar_artists",
    description: "Get similar artists for an artist on Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string", description: "Artist name" },
        limit: { type: "number", description: "Max results" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_get_chart_top_artists",
    description: "Get the global top artists chart from Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
    },
  },
  {
    name: "lastfm_get_chart_top_tracks",
    description: "Get the global top tracks chart from Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
    },
  },
  {
    name: "lastfm_get_album_info",
    description: "Get album info from Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string", description: "Artist name" },
        album: { type: "string", description: "Album name" },
        lang: { type: "string", description: "Language code for description (e.g. en)" },
        api_key: { type: "string", description: "Last.fm API key (or set LASTFM_API_KEY)" },
      },
      required: ["artist", "album"],
    },
  },
  // ─── Lichess ───────────────────────────────────────────────────────────────
  {
    name: "lichess_user",
    description: "Get a Lichess user's profile and ratings. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Lichess username" },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_user_games",
    description: "Get recent games for a Lichess user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Lichess username" },
        max: { type: "number", description: "Max games to return (default 10, max 50)" },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_puzzle_daily",
    description: "Get the daily puzzle from Lichess.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "lichess_top_players",
    description: "Get top players for a Lichess performance type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        perfType: { type: "string", description: "Performance type: bullet, blitz, rapid, classical, etc." },
      },
    },
  },
  {
    name: "lichess_tournament",
    description: "Get details for a Lichess tournament by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Lichess tournament ID" },
      },
      required: ["id"],
    },
  },
  // ─── MusicBrainz ───────────────────────────────────────────────────────────
  {
    name: "mb_search_artists",
    description: "Search for artists in the MusicBrainz database. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_search_releases",
    description: "Search for releases (albums) in MusicBrainz.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        artist: { type: "string", description: "Optional artist name filter" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_search_recordings",
    description: "Search for recordings (tracks) in MusicBrainz.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        artist: { type: "string", description: "Optional artist name filter" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_get_artist",
    description: "Get a MusicBrainz artist by MBID (MusicBrainz ID).",
    inputSchema: {
      type: "object" as const,
      properties: {
        mbid: { type: "string", description: "MusicBrainz artist ID (UUID)" },
      },
      required: ["mbid"],
    },
  },
  {
    name: "mb_get_release",
    description: "Get a MusicBrainz release by MBID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        mbid: { type: "string", description: "MusicBrainz release ID (UUID)" },
      },
      required: ["mbid"],
    },
  },
  // ─── NASA ──────────────────────────────────────────────────────────────────
  {
    name: "nasa_apod",
    description: "Get NASA's Astronomy Picture of the Day. Uses DEMO_KEY if no NASA_API_KEY set.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Optional date in YYYY-MM-DD format" },
        api_key: { type: "string", description: "NASA API key (or set NASA_API_KEY, or uses DEMO_KEY)" },
      },
    },
  },
  {
    name: "nasa_asteroids",
    description: "Get near-Earth asteroids for a date range from NASA NeoWs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD (max 7 days from start)" },
        api_key: { type: "string", description: "NASA API key (or set NASA_API_KEY, or uses DEMO_KEY)" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "nasa_mars_photos",
    description: "Get photos from Mars rovers (Curiosity, Perseverance, etc.) via NASA API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        rover: { type: "string", description: "Rover name: curiosity, opportunity, spirit, or perseverance" },
        sol: { type: "number", description: "Martian sol (day) number" },
        earth_date: { type: "string", description: "Earth date YYYY-MM-DD (alternative to sol)" },
        camera: { type: "string", description: "Camera abbreviation (optional)" },
        api_key: { type: "string", description: "NASA API key (or set NASA_API_KEY, or uses DEMO_KEY)" },
      },
    },
  },
  {
    name: "nasa_earth_imagery",
    description: "Get satellite imagery of Earth for a lat/lon from NASA.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lat: { type: "number", description: "Latitude" },
        lon: { type: "number", description: "Longitude" },
        date: { type: "string", description: "Optional date YYYY-MM-DD" },
        api_key: { type: "string", description: "NASA API key (or set NASA_API_KEY, or uses DEMO_KEY)" },
      },
      required: ["lat", "lon"],
    },
  },
  {
    name: "nasa_epic",
    description: "Get Earth imagery from NASA's EPIC camera on DSCOVR satellite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Optional date YYYY-MM-DD" },
        api_key: { type: "string", description: "NASA API key (or set NASA_API_KEY, or uses DEMO_KEY)" },
      },
    },
  },
  // ─── NewsAPI ───────────────────────────────────────────────────────────────
  {
    name: "news_get_top_headlines",
    description: "Get top news headlines from NewsAPI. Requires NEWS_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        country: { type: "string", description: "2-letter country code, e.g. us" },
        category: { type: "string", description: "Category: business, entertainment, health, science, sports, technology" },
        sources: { type: "string", description: "News source IDs (comma-separated)" },
        query: { type: "string", description: "Keywords to search" },
        page_size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "NewsAPI key (or set NEWS_API_KEY)" },
      },
    },
  },
  {
    name: "news_search_news",
    description: "Search all news articles from NewsAPI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        from_date: { type: "string", description: "From date YYYY-MM-DD" },
        to_date: { type: "string", description: "To date YYYY-MM-DD" },
        language: { type: "string", description: "Language code, e.g. en" },
        sort_by: { type: "string", description: "Sort: relevancy, popularity, publishedAt" },
        sources: { type: "string", description: "News source IDs" },
        domains: { type: "string", description: "Domains to restrict to" },
        page_size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "NewsAPI key (or set NEWS_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "news_get_sources",
    description: "Get available news sources from NewsAPI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Optional category filter" },
        language: { type: "string", description: "Optional language filter" },
        country: { type: "string", description: "Optional country filter" },
        api_key: { type: "string", description: "NewsAPI key (or set NEWS_API_KEY)" },
      },
    },
  },
  // ─── Numbers API ───────────────────────────────────────────────────────────
  {
    name: "number_fact",
    description: "Get an interesting fact about a number from the Numbers API. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        number: { type: "string", description: "The number to get a fact about" },
        type: { type: "string", description: "Type: trivia, math, date, or year", enum: ["trivia", "math", "date", "year"] },
      },
      required: ["number"],
    },
  },
  {
    name: "number_random",
    description: "Get a fact about a random number from the Numbers API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Type: trivia, math, date, or year", enum: ["trivia", "math", "date", "year"] },
      },
    },
  },
  // ─── OMDB ──────────────────────────────────────────────────────────────────
  {
    name: "omdb_search",
    description: "Search movies and TV shows on OMDB. Requires OMDB_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        s: { type: "string", description: "Search query" },
        type: { type: "string", description: "Type: movie, series, or episode" },
        y: { type: "string", description: "Year filter" },
        page: { type: "number", description: "Page number" },
      },
      required: ["s"],
    },
  },
  {
    name: "omdb_get_by_title",
    description: "Get a movie or TV show from OMDB by title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        t: { type: "string", description: "Title to search" },
        type: { type: "string", description: "Type: movie, series, or episode" },
        y: { type: "string", description: "Year filter" },
      },
      required: ["t"],
    },
  },
  {
    name: "omdb_get_by_id",
    description: "Get a movie or TV show from OMDB by IMDb ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        i: { type: "string", description: "IMDb ID, e.g. tt0111161" },
      },
      required: ["i"],
    },
  },
  // ─── Open Exchange Rates ───────────────────────────────────────────────────
  {
    name: "forex_latest",
    description: "Get latest exchange rates from Open Exchange Rates. Requires OPENEXCHANGERATES_APP_ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        base: { type: "string", description: "Base currency (paid plan only, default USD)" },
        symbols: { type: "string", description: "Comma-separated currencies to return" },
      },
    },
  },
  {
    name: "forex_historical",
    description: "Get historical exchange rates for a date from Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        base: { type: "string", description: "Base currency" },
        symbols: { type: "string", description: "Comma-separated currencies to return" },
      },
      required: ["date"],
    },
  },
  {
    name: "forex_currencies",
    description: "Get list of all supported currencies from Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "forex_convert",
    description: "Convert an amount between currencies using Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number", description: "Amount to convert" },
        from: { type: "string", description: "Source currency code" },
        to: { type: "string", description: "Target currency code" },
        date: { type: "string", description: "Optional date for historical rate YYYY-MM-DD" },
      },
      required: ["value", "from", "to"],
    },
  },
  // ─── OpenF1 (Formula 1) ────────────────────────────────────────────────────
  {
    name: "f1_sessions",
    description: "Get F1 sessions from OpenF1. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Year filter" },
        country: { type: "string", description: "Country name filter" },
        session_name: { type: "string", description: "Session name filter, e.g. Race" },
      },
    },
  },
  {
    name: "f1_drivers",
    description: "Get F1 drivers for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key (optional)" },
      },
    },
  },
  {
    name: "f1_positions",
    description: "Get race positions for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
        driver_number: { type: "number", description: "Optional driver number filter" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_laps",
    description: "Get lap times for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
        driver_number: { type: "number", description: "Optional driver number filter" },
        lap_number: { type: "number", description: "Optional lap number filter" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_pit_stops",
    description: "Get pit stop data for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
        driver_number: { type: "number", description: "Optional driver number filter" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_car_data",
    description: "Get car telemetry data for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
        driver_number: { type: "number", description: "Optional driver number filter" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_team_radio",
    description: "Get team radio messages for a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
        driver_number: { type: "number", description: "Optional driver number filter" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_weather",
    description: "Get weather data during a session from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number", description: "OpenF1 session key" },
      },
      required: ["session_key"],
    },
  },
  // ─── Open Library ──────────────────────────────────────────────────────────
  {
    name: "openlibrary_search",
    description: "Search for books on Open Library. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "General search query" },
        title: { type: "string", description: "Title search" },
        author: { type: "string", description: "Author search" },
        isbn: { type: "string", description: "ISBN search" },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  {
    name: "openlibrary_get_book",
    description: "Get a book from Open Library by its work key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Open Library work key, e.g. OL45804W" },
      },
      required: ["key"],
    },
  },
  {
    name: "openlibrary_get_edition",
    description: "Get a book edition from Open Library by ISBN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        isbn: { type: "string", description: "ISBN (10 or 13 digits)" },
      },
      required: ["isbn"],
    },
  },
  {
    name: "openlibrary_get_author",
    description: "Get an author from Open Library by author key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Open Library author key, e.g. OL23919A" },
      },
      required: ["key"],
    },
  },
  {
    name: "openlibrary_author_works",
    description: "Get works by an author from Open Library.",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Open Library author key, e.g. OL23919A" },
      },
      required: ["key"],
    },
  },
  {
    name: "openlibrary_trending",
    description: "Get trending books from Open Library.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // ─── Open-Meteo ────────────────────────────────────────────────────────────
  {
    name: "weather_current",
    description: "Get current weather for a location using Open-Meteo. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name (geocoded automatically)" },
        latitude: { type: "number", description: "Latitude (alternative to city)" },
        longitude: { type: "number", description: "Longitude (alternative to city)" },
      },
    },
  },
  {
    name: "weather_forecast",
    description: "Get weather forecast for a location using Open-Meteo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name (geocoded automatically)" },
        latitude: { type: "number", description: "Latitude (alternative to city)" },
        longitude: { type: "number", description: "Longitude (alternative to city)" },
        days: { type: "number", description: "Number of forecast days (1-16, default 7)" },
      },
    },
  },
  {
    name: "weather_hourly",
    description: "Get hourly weather forecast (next 48 hours) using Open-Meteo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name (geocoded automatically)" },
        latitude: { type: "number", description: "Latitude (alternative to city)" },
        longitude: { type: "number", description: "Longitude (alternative to city)" },
      },
    },
  },
  // ─── Podcast Index ─────────────────────────────────────────────────────────
  {
    name: "podcast_search",
    description: "Search for podcasts on Podcast Index. Requires PODCASTINDEX_API_KEY and PODCASTINDEX_API_SECRET.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search query" },
        max: { type: "number", description: "Max results" },
      },
      required: ["q"],
    },
  },
  {
    name: "podcast_get_by_feed_url",
    description: "Get a podcast by its RSS feed URL from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "RSS feed URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "podcast_get_episodes",
    description: "Get episodes for a podcast by feed ID from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        feed_id: { type: "number", description: "Podcast Index feed ID" },
        max: { type: "number", description: "Max episodes" },
        since: { type: "number", description: "Unix timestamp - return episodes since this time" },
      },
      required: ["feed_id"],
    },
  },
  {
    name: "podcast_search_episodes",
    description: "Search for podcast episodes on Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Search query" },
        max: { type: "number", description: "Max results" },
      },
      required: ["q"],
    },
  },
  {
    name: "podcast_trending",
    description: "Get trending podcasts from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max: { type: "number", description: "Max results" },
        lang: { type: "string", description: "Language filter, e.g. en" },
        cat: { type: "string", description: "Category filter" },
      },
    },
  },
  {
    name: "podcast_recent_episodes",
    description: "Get recently released podcast episodes from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max: { type: "number", description: "Max results" },
      },
    },
  },
  // ─── PTV (Public Transport Victoria) ──────────────────────────────────────
  {
    name: "ptv_search",
    description: "Search PTV (Public Transport Victoria) for stops, routes, and outlets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term (stop name, suburb, route number)" },
      },
      required: ["query"],
    },
  },
  {
    name: "ptv_departures",
    description: "Get upcoming departures from a PTV stop.",
    inputSchema: {
      type: "object" as const,
      properties: {
        stop_id: { type: "string", description: "PTV stop ID" },
        route_type: { type: "number", description: "Route type: 0=Train, 1=Tram, 2=Bus, 3=Vline, 4=Night Bus" },
        max_results: { type: "number", description: "Max results (default 5)" },
        route_id: { type: "string", description: "Optional route ID filter" },
        direction_id: { type: "string", description: "Optional direction ID filter" },
        look_backwards: { type: "boolean", description: "Include past departures" },
        include_cancelled: { type: "boolean", description: "Include cancelled departures" },
      },
      required: ["stop_id"],
    },
  },
  {
    name: "ptv_disruptions",
    description: "Get current service disruptions on PTV network.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_type: { type: "number", description: "Optional route type filter" },
        disruption_status: { type: "string", description: "Filter: current or planned" },
      },
    },
  },
  {
    name: "ptv_stops_on_route",
    description: "Get all stops on a PTV route.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_id: { type: "string", description: "PTV route ID" },
        route_type: { type: "number", description: "Route type: 0=Train, 1=Tram, 2=Bus, etc." },
        direction_id: { type: "string", description: "Optional direction ID" },
      },
      required: ["route_id"],
    },
  },
  {
    name: "ptv_route_directions",
    description: "Get directions for a PTV route.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_id: { type: "string", description: "PTV route ID" },
      },
      required: ["route_id"],
    },
  },
  // ─── Radio Browser ─────────────────────────────────────────────────────────
  {
    name: "radio_search",
    description: "Search for internet radio stations on Radio Browser. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Station name filter" },
        country: { type: "string", description: "Country filter" },
        language: { type: "string", description: "Language filter" },
        tag: { type: "string", description: "Genre/tag filter" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "radio_by_country",
    description: "Get internet radio stations by country.",
    inputSchema: {
      type: "object" as const,
      properties: {
        country: { type: "string", description: "Country name, e.g. 'Australia'" },
        limit: { type: "number", description: "Max results (default 30)" },
      },
      required: ["country"],
    },
  },
  {
    name: "radio_top_clicked",
    description: "Get most-clicked internet radio stations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "radio_top_voted",
    description: "Get most-voted internet radio stations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "radio_by_tag",
    description: "Get internet radio stations by genre/tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag: { type: "string", description: "Genre tag, e.g. jazz, classical, news" },
        limit: { type: "number", description: "Max results (default 30)" },
      },
      required: ["tag"],
    },
  },
  {
    name: "radio_countries",
    description: "Get list of countries with radio station counts.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // ─── REST Countries ────────────────────────────────────────────────────────
  {
    name: "country_all",
    description: "Get data for all countries from REST Countries. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fields: { type: "string", description: "Optional comma-separated fields to include" },
      },
    },
  },
  {
    name: "country_by_name",
    description: "Get country data by name from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Country name" },
      },
      required: ["name"],
    },
  },
  {
    name: "country_by_code",
    description: "Get country data by ISO country code from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "ISO 2 or 3 letter country code" },
      },
      required: ["code"],
    },
  },
  {
    name: "country_by_region",
    description: "Get countries by region from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        region: { type: "string", description: "Region: Africa, Americas, Asia, Europe, Oceania, or Antarctic" },
      },
      required: ["region"],
    },
  },
  {
    name: "country_by_currency",
    description: "Get countries that use a specific currency from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        currency: { type: "string", description: "Currency code, e.g. USD" },
      },
      required: ["currency"],
    },
  },
  {
    name: "country_by_language",
    description: "Get countries where a language is spoken from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        language: { type: "string", description: "Language name, e.g. english, spanish" },
      },
      required: ["language"],
    },
  },
  // ─── SeatGeek ──────────────────────────────────────────────────────────────
  {
    name: "seatgeek_search_events",
    description: "Search for events on SeatGeek. Requires SEATGEEK_CLIENT_ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        venue_id: { type: "string", description: "Venue ID filter" },
        type: { type: "string", description: "Event type filter" },
        datetime_local: { type: "string", description: "Date filter" },
        city: { type: "string", description: "City filter" },
        state: { type: "string", description: "State filter" },
        country: { type: "string", description: "Country filter" },
        per_page: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
    },
  },
  {
    name: "seatgeek_get_event",
    description: "Get a SeatGeek event by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "SeatGeek event ID" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "seatgeek_search_performers",
    description: "Search for performers on SeatGeek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        per_page: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
      required: ["query"],
    },
  },
  {
    name: "seatgeek_get_performer",
    description: "Get a SeatGeek performer by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "SeatGeek performer ID" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
      required: ["id"],
    },
  },
  {
    name: "seatgeek_search_venues",
    description: "Search for venues on SeatGeek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        city: { type: "string", description: "City filter" },
        state: { type: "string", description: "State filter" },
        country: { type: "string", description: "Country filter" },
        per_page: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
    },
  },
  {
    name: "seatgeek_get_venue",
    description: "Get a SeatGeek venue by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "SeatGeek venue ID" },
        client_id: { type: "string", description: "SeatGeek client ID (or set SEATGEEK_CLIENT_ID)" },
      },
      required: ["id"],
    },
  },
  // ─── Setlist.fm ────────────────────────────────────────────────────────────
  {
    name: "setlistfm_search_artist",
    description: "Search for artists on Setlist.fm. Requires SETLISTFM_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artistName: { type: "string", description: "Artist name to search" },
        api_key: { type: "string", description: "Setlist.fm API key (or set SETLISTFM_API_KEY)" },
      },
    },
  },
  {
    name: "setlistfm_artist_setlists",
    description: "Get setlists for an artist by MusicBrainz ID from Setlist.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        mbid: { type: "string", description: "MusicBrainz ID of the artist" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Setlist.fm API key (or set SETLISTFM_API_KEY)" },
      },
      required: ["mbid"],
    },
  },
  {
    name: "setlistfm_search_setlists",
    description: "Search for setlists on Setlist.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artistName: { type: "string", description: "Artist name filter" },
        venueName: { type: "string", description: "Venue name filter" },
        cityName: { type: "string", description: "City name filter" },
        year: { type: "number", description: "Year filter" },
        api_key: { type: "string", description: "Setlist.fm API key (or set SETLISTFM_API_KEY)" },
      },
    },
  },
  {
    name: "setlistfm_get_setlist",
    description: "Get a specific setlist from Setlist.fm by setlist ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        setlistId: { type: "string", description: "Setlist.fm setlist ID" },
        api_key: { type: "string", description: "Setlist.fm API key (or set SETLISTFM_API_KEY)" },
      },
      required: ["setlistId"],
    },
  },
  // ─── Ticketmaster ──────────────────────────────────────────────────────────
  {
    name: "tm_search_events",
    description: "Search for events on Ticketmaster. Requires TICKETMASTER_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search keyword" },
        city: { type: "string", description: "City filter" },
        country: { type: "string", description: "Country code filter" },
        start_date: { type: "string", description: "Start date (ISO 8601)" },
        end_date: { type: "string", description: "End date (ISO 8601)" },
        classification: { type: "string", description: "Classification/genre filter" },
        size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        sort: { type: "string", description: "Sort order" },
        api_key: { type: "string", description: "Ticketmaster API key (or set TICKETMASTER_API_KEY)" },
      },
    },
  },
  {
    name: "tm_get_event",
    description: "Get a Ticketmaster event by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Ticketmaster event ID" },
        api_key: { type: "string", description: "Ticketmaster API key (or set TICKETMASTER_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "tm_search_venues",
    description: "Search for venues on Ticketmaster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search keyword" },
        city: { type: "string", description: "City filter" },
        country: { type: "string", description: "Country code filter" },
        state: { type: "string", description: "State code filter" },
        size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Ticketmaster API key (or set TICKETMASTER_API_KEY)" },
      },
    },
  },
  {
    name: "tm_get_venue",
    description: "Get a Ticketmaster venue by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Ticketmaster venue ID" },
        api_key: { type: "string", description: "Ticketmaster API key (or set TICKETMASTER_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "tm_search_attractions",
    description: "Search for attractions (artists, teams) on Ticketmaster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search keyword" },
        classification: { type: "string", description: "Classification filter" },
        size: { type: "number", description: "Results per page" },
        page: { type: "number", description: "Page number" },
        api_key: { type: "string", description: "Ticketmaster API key (or set TICKETMASTER_API_KEY)" },
      },
    },
  },
  // ─── TMDB (The Movie Database) ─────────────────────────────────────────────
  {
    name: "tmdb_search_movies",
    description: "Search for movies on TMDB. Requires TMDB_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Movie title search query" },
        year: { type: "string", description: "Optional year filter" },
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "tmdb_search_tv",
    description: "Search for TV shows on TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "TV show title search query" },
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
      required: ["query"],
    },
  },
  {
    name: "tmdb_movie",
    description: "Get detailed information for a TMDB movie by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "TMDB movie ID" },
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "tmdb_tv",
    description: "Get detailed information for a TMDB TV show by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "TMDB TV show ID" },
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "tmdb_trending",
    description: "Get trending movies and TV shows from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        media_type: { type: "string", description: "Media type: movie, tv, or all", enum: ["movie", "tv", "all"] },
        time_window: { type: "string", description: "Time window: day or week", enum: ["day", "week"] },
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
    },
  },
  {
    name: "tmdb_now_playing",
    description: "Get movies currently in theaters from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
    },
  },
  {
    name: "tmdb_upcoming",
    description: "Get upcoming movies from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
    },
  },
  {
    name: "tmdb_popular_tv",
    description: "Get popular TV shows from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "TMDB API key (or set TMDB_API_KEY)" },
      },
    },
  },
  // ─── Tomorrow.io Weather ───────────────────────────────────────────────────
  {
    name: "tomorrow_realtime",
    description: "Get real-time weather from Tomorrow.io. Requires TOMORROWIO_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "City name, lat/lon, or postal code" },
      },
      required: ["location"],
    },
  },
  {
    name: "tomorrow_forecast",
    description: "Get weather forecast from Tomorrow.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "City name, lat/lon, or postal code" },
        timesteps: { type: "string", description: "Timestep: 1h or 1d" },
        fields: { type: "string", description: "Optional comma-separated weather fields" },
      },
      required: ["location"],
    },
  },
  {
    name: "tomorrow_history",
    description: "Get historical weather data from Tomorrow.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "City name, lat/lon, or postal code" },
        startTime: { type: "string", description: "Start time (ISO 8601)" },
        endTime: { type: "string", description: "End time (ISO 8601)" },
      },
      required: ["location", "startTime", "endTime"],
    },
  },
  // ─── Trivia ────────────────────────────────────────────────────────────────
  {
    name: "trivia_questions",
    description: "Get trivia questions from the Open Trivia Database. No auth required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: { type: "number", description: "Number of questions (1-50, default 10)" },
        category: { type: "number", description: "Category ID (use trivia_categories to get IDs)" },
        difficulty: { type: "string", description: "Difficulty: easy, medium, or hard", enum: ["easy", "medium", "hard"] },
        type: { type: "string", description: "Question type: multiple or boolean", enum: ["multiple", "boolean"] },
      },
    },
  },
  {
    name: "trivia_categories",
    description: "Get all available trivia categories from the Open Trivia Database.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  // ─── Twitch ────────────────────────────────────────────────────────────────
  {
    name: "twitch_search_streams",
    description: "Search for Twitch channels/streams. Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        first: { type: "number", description: "Max results" },
        after: { type: "string", description: "Pagination cursor" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["query"],
    },
  },
  {
    name: "twitch_get_stream",
    description: "Check if a Twitch channel is currently live.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Twitch channel login name" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["channel"],
    },
  },
  {
    name: "twitch_search_games",
    description: "Search for Twitch games/categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Game name search query" },
        first: { type: "number", description: "Max results" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["query"],
    },
  },
  {
    name: "twitch_get_top_games",
    description: "Get the top games currently being streamed on Twitch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        first: { type: "number", description: "Max results" },
        after: { type: "string", description: "Pagination cursor" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
    },
  },
  {
    name: "twitch_get_clips",
    description: "Get top clips for a Twitch channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Twitch channel login name" },
        first: { type: "number", description: "Max results" },
        after: { type: "string", description: "Pagination cursor" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["channel"],
    },
  },
  {
    name: "twitch_get_channel_info",
    description: "Get info about a Twitch channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Twitch channel login name" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["channel"],
    },
  },
  {
    name: "twitch_get_schedule",
    description: "Get the stream schedule for a Twitch channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", description: "Twitch channel login name" },
        first: { type: "number", description: "Max results" },
        start_time: { type: "string", description: "Start time filter (ISO 8601)" },
        client_id: { type: "string", description: "Twitch client ID (or set TWITCH_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch client secret (or set TWITCH_CLIENT_SECRET)" },
      },
      required: ["channel"],
    },
  },
  // ─── Wise ──────────────────────────────────────────────────────────────────
  {
    name: "wise_exchange_rates",
    description: "Get exchange rates from Wise. Requires WISE_API_TOKEN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string", description: "Source currency code, e.g. USD" },
        target: { type: "string", description: "Target currency code, e.g. EUR" },
        amount: { type: "number", description: "Optional amount to convert" },
      },
      required: ["source", "target"],
    },
  },
  {
    name: "wise_profile",
    description: "Get Wise account profiles for the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "wise_accounts",
    description: "Get Wise borderless account balances.",
    inputSchema: {
      type: "object" as const,
      properties: {
        profileId: { type: "string", description: "Wise profile ID (from wise_profile)" },
      },
      required: ["profileId"],
    },
  },
  {
    name: "wise_create_quote",
    description: "Create a transfer quote on Wise.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sourceCurrency: { type: "string", description: "Source currency code" },
        targetCurrency: { type: "string", description: "Target currency code" },
        sourceAmount: { type: "number", description: "Source amount (provide either sourceAmount or targetAmount)" },
        targetAmount: { type: "number", description: "Target amount (provide either sourceAmount or targetAmount)" },
      },
      required: ["sourceCurrency", "targetCurrency"],
    },
  },
  // ─── Yelp ──────────────────────────────────────────────────────────────────
  {
    name: "yelp_search_businesses",
    description: "Search for businesses on Yelp. Requires YELP_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "Location, e.g. 'San Francisco, CA'" },
        term: { type: "string", description: "Search term, e.g. 'coffee'" },
        categories: { type: "string", description: "Category filter" },
        price: { type: "string", description: "Price filter: 1, 2, 3, 4 or combinations" },
        radius: { type: "number", description: "Search radius in meters (max 40000)" },
        sort_by: { type: "string", description: "Sort: best_match, rating, review_count, distance" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Offset for pagination" },
        open_now: { type: "boolean", description: "Filter to open businesses only" },
        api_key: { type: "string", description: "Yelp API key (or set YELP_API_KEY)" },
      },
      required: ["location"],
    },
  },
  {
    name: "yelp_get_business",
    description: "Get details for a Yelp business by ID or alias.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Yelp business ID or alias" },
        api_key: { type: "string", description: "Yelp API key (or set YELP_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "yelp_get_reviews",
    description: "Get reviews for a Yelp business.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Yelp business ID or alias" },
        sort_by: { type: "string", description: "Sort order" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Offset for pagination" },
        language: { type: "string", description: "Language filter" },
        api_key: { type: "string", description: "Yelp API key (or set YELP_API_KEY)" },
      },
      required: ["id"],
    },
  },
  {
    name: "yelp_search_events",
    description: "Search for events on Yelp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "Location string" },
        latitude: { type: "number", description: "Latitude" },
        longitude: { type: "number", description: "Longitude" },
        category: { type: "string", description: "Event category" },
        start_date: { type: "string", description: "Start date filter" },
        end_date: { type: "string", description: "End date filter" },
        limit: { type: "number", description: "Max results" },
        offset: { type: "number", description: "Offset for pagination" },
        api_key: { type: "string", description: "Yelp API key (or set YELP_API_KEY)" },
      },
    },
  },
  {
    name: "yelp_get_autocomplete",
    description: "Get autocomplete suggestions for a search term on Yelp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "Search text to autocomplete" },
        latitude: { type: "number", description: "Optional latitude bias" },
        longitude: { type: "number", description: "Optional longitude bias" },
        locale: { type: "string", description: "Locale, e.g. en_US" },
        api_key: { type: "string", description: "Yelp API key (or set YELP_API_KEY)" },
      },
      required: ["text"],
    },
  },
] as const;

// ─── Handler map for direct tools ───────────────────────────────────────────

type DirectHandler = (
  client: UnClickClient,
  args: Record<string, unknown>
) => Promise<unknown>;

const DIRECT_HANDLERS: Record<string, DirectHandler> = {
  unclick_shorten_url: (c, a) => c.call("POST", "/v1/shorten", a as Record<string, unknown>),

  unclick_generate_qr: (c, a) => c.call("POST", "/v1/qr", a as Record<string, unknown>),

  unclick_hash: (c, a) => c.call("POST", "/v1/hash", a as Record<string, unknown>),

  unclick_transform_text: (c, a) =>
    c.call("POST", "/v1/transform/case", a as Record<string, unknown>),

  unclick_validate_email: (c, a) =>
    c.call("POST", "/v1/validate/email", a as Record<string, unknown>),

  unclick_validate_url: (c, a) =>
    c.call("POST", "/v1/validate/url", a as Record<string, unknown>),

  unclick_resize_image: (c, a) =>
    c.call("POST", "/v1/image/resize", a as Record<string, unknown>),

  unclick_parse_csv: (c, a) =>
    c.call("POST", "/v1/csv/parse", a as Record<string, unknown>),

  unclick_json_format: (c, a) =>
    c.call("POST", "/v1/json/format", a as Record<string, unknown>),

  unclick_encode: async (c, a) => {
    const op = a.operation as string;
    const [action, format] = op.split("_") as [string, string];
    const path = `/${action}/${format}`.replace("_", "/");
    return c.call("POST", `/v1${path}`, { text: a.text });
  },

  unclick_generate_uuid: (c, a) =>
    c.call("POST", "/v1/uuid/v4", a as Record<string, unknown>),

  unclick_random_password: (c, a) =>
    c.call("POST", "/v1/random/password", a as Record<string, unknown>),

  unclick_cron_parse: async (c, a) => {
    const [parsed, next] = await Promise.all([
      c.call("POST", "/v1/cron/parse", { expression: a.expression }),
      c.call("POST", "/v1/cron/next", {
        expression: a.expression,
        count: a.next_count ?? 5,
      }),
    ]);
    return { ...parsed as object, ...(next as object) };
  },

  unclick_ip_parse: (c, a) =>
    c.call("POST", "/v1/ip/parse", a as Record<string, unknown>),

  unclick_color_convert: (c, a) =>
    c.call("POST", "/v1/color/convert", a as Record<string, unknown>),

  unclick_regex_test: (c, a) =>
    c.call("POST", "/v1/regex/test", a as Record<string, unknown>),

  unclick_timestamp_convert: (c, a) =>
    c.call("POST", "/v1/timestamp/convert", a as Record<string, unknown>),

  unclick_diff_text: (c, a) =>
    c.call("POST", "/v1/diff/lines", a as Record<string, unknown>),

  unclick_kv_set: (c, a) =>
    c.call("POST", "/v1/kv/set", a as Record<string, unknown>),

  unclick_kv_get: (c, a) =>
    c.call("POST", "/v1/kv/get", a as Record<string, unknown>),

  report_bug: (c, a) =>
    c.call("POST", "/v1/report-bug", a as Record<string, unknown>),

  // ─── ABN ──────────────────────────────────────────────────────────────────
  abn_lookup: (_c, a) => abnLookup(a),
  abn_search: (_c, a) => abnSearch(a),

  // ─── Alpha Vantage ────────────────────────────────────────────────────────
  stock_quote: (_c, a) => stockQuote(a),
  stock_search: (_c, a) => stockSearch(a),
  stock_daily: (_c, a) => stockDaily(a),
  stock_intraday: (_c, a) => stockIntraday(a),
  forex_rate: (_c, a) => forexRate(a),
  crypto_daily: (_c, a) => cryptoDaily(a),

  // ─── Bandsintown ──────────────────────────────────────────────────────────
  bandsintown_artist: (_c, a) => bandsintownArtist(a),
  bandsintown_events: (_c, a) => bandsintownEvents(a),
  bandsintown_recommended: (_c, a) => bandsintownRecommended(a),

  // ─── Chess.com ────────────────────────────────────────────────────────────
  chess_player: (_c, a) => chessPlayer(a),
  chess_player_stats: (_c, a) => chessPlayerStats(a),
  chess_player_games: (_c, a) => chessPlayerGames(a),
  chess_puzzles_random: (_c, a) => chessPuzzlesRandom(a),
  chess_leaderboards: (_c, a) => chessLeaderboards(a),

  // ─── CoinGecko ────────────────────────────────────────────────────────────
  crypto_price: (_c, a) => cryptoPrice(a),
  crypto_coin: (_c, a) => cryptoCoin(a),
  crypto_search: (_c, a) => cryptoSearch(a),
  crypto_trending: (_c, a) => cryptoTrending(a),
  crypto_top_coins: (_c, a) => cryptoTopCoins(a),
  crypto_coin_history: (_c, a) => cryptoCoinHistory(a),

  // ─── CoinMarketCap ────────────────────────────────────────────────────────
  cmc_listings: (_c, a) => cmcListings(a),
  cmc_quotes: (_c, a) => cmcQuotes(a),
  cmc_info: (_c, a) => cmcInfo(a),
  cmc_trending: (_c, a) => cmcTrending(a),
  cmc_global_metrics: (_c, a) => cmcGlobalMetrics(a),

  // ─── Discogs ──────────────────────────────────────────────────────────────
  discogs_search_releases: (_c, a) => discogsSearchReleases(a),
  discogs_get_release: (_c, a) => discogsGetRelease(a),
  discogs_get_artist: (_c, a) => discogsGetArtist(a),
  discogs_search_artists: (_c, a) => discogsSearchArtists(a),
  discogs_get_marketplace_stats: (_c, a) => discogsGetMarketplaceStats(a),
  discogs_get_label: (_c, a) => discogsGetLabel(a),

  // ─── Eventbrite ───────────────────────────────────────────────────────────
  eventbrite_search_events: (_c, a) => eventbriteSearchEvents(a),
  eventbrite_get_event: (_c, a) => eventbriteGetEvent(a),
  eventbrite_get_event_attendees: (_c, a) => eventbriteGetEventAttendees(a),
  eventbrite_create_event: (_c, a) => eventbriteCreateEvent(a),
  eventbrite_list_categories: (_c, a) => eventbriteListCategories(a),
  eventbrite_get_venue: (_c, a) => eventbriteGetVenue(a),

  // ─── Foursquare ───────────────────────────────────────────────────────────
  foursquare_search_places: (_c, a) => foursquareSearchPlaces(a),
  foursquare_get_place: (_c, a) => foursquareGetPlace(a),
  foursquare_get_photos: (_c, a) => foursquareGetPhotos(a),
  foursquare_get_tips: (_c, a) => foursquareGetTips(a),
  foursquare_autocomplete: (_c, a) => foursquareAutocomplete(a),

  // ─── Fantasy Premier League ───────────────────────────────────────────────
  fpl_bootstrap: (_c, a) => fplBootstrap(a),
  fpl_player: (_c, a) => fplPlayer(a),
  fpl_gameweek: (_c, a) => fplGameweek(a),
  fpl_fixtures: (_c, a) => fplFixtures(a),
  fpl_my_team: (_c, a) => fplMyTeam(a),
  fpl_manager: (_c, a) => fplManager(a),
  fpl_leagues_classic: (_c, a) => fplLeaguesClassic(a),

  // ─── Genius ───────────────────────────────────────────────────────────────
  genius_search: (_c, a) => geniusSearch(a),
  genius_get_song: (_c, a) => geniusGetSong(a),
  genius_get_artist: (_c, a) => geniusGetArtist(a),
  genius_artist_songs: (_c, a) => geniusArtistSongs(a),

  // ─── The Guardian ─────────────────────────────────────────────────────────
  guardian_search_articles: (_c, a) => guardianSearchArticles(a),
  guardian_get_article: (_c, a) => guardianGetArticle(a),
  guardian_get_sections: (_c, a) => guardianGetSections(a),
  guardian_get_tags: (_c, a) => guardianGetTags(a),
  guardian_get_edition: (_c, a) => guardianGetEdition(a),

  // ─── Hacker News ──────────────────────────────────────────────────────────
  hn_top_stories: (_c, a) => hnTopStories(a),
  hn_new_stories: (_c, a) => hnNewStories(a),
  hn_best_stories: (_c, a) => hnBestStories(a),
  hn_ask_hn: (_c, a) => hnAskHn(a),
  hn_show_hn: (_c, a) => hnShowHn(a),
  hn_item: (_c, a) => hnItem(a),
  hn_user: (_c, a) => hnUser(a),

  // ─── IP API ───────────────────────────────────────────────────────────────
  ip_lookup: (_c, a) => ipLookup(a),
  ip_batch: (_c, a) => ipBatch(a),

  // ─── Last.fm ──────────────────────────────────────────────────────────────
  lastfm_get_artist_info: (_c, a) => lastfmGetArtistInfo(a),
  lastfm_search_artists: (_c, a) => lastfmSearchArtists(a),
  lastfm_get_top_tracks: (_c, a) => lastfmGetTopTracks(a),
  lastfm_get_similar_artists: (_c, a) => lastfmGetSimilarArtists(a),
  lastfm_get_chart_top_artists: (_c, a) => lastfmGetChartTopArtists(a),
  lastfm_get_chart_top_tracks: (_c, a) => lastfmGetChartTopTracks(a),
  lastfm_get_album_info: (_c, a) => lastfmGetAlbumInfo(a),

  // ─── Lichess ──────────────────────────────────────────────────────────────
  lichess_user: (_c, a) => lichessUser(a),
  lichess_user_games: (_c, a) => lichessUserGames(a),
  lichess_puzzle_daily: (_c, a) => lichessPuzzleDaily(a),
  lichess_top_players: (_c, a) => lichessTopPlayers(a),
  lichess_tournament: (_c, a) => lichessTournament(a),

  // ─── MusicBrainz ──────────────────────────────────────────────────────────
  mb_search_artists: (_c, a) => mbSearchArtists(a),
  mb_search_releases: (_c, a) => mbSearchReleases(a),
  mb_search_recordings: (_c, a) => mbSearchRecordings(a),
  mb_get_artist: (_c, a) => mbGetArtist(a),
  mb_get_release: (_c, a) => mbGetRelease(a),

  // ─── NASA ─────────────────────────────────────────────────────────────────
  nasa_apod: (_c, a) => nasaApod(a),
  nasa_asteroids: (_c, a) => nasaAsteroids(a),
  nasa_mars_photos: (_c, a) => nasaMarsPhotos(a),
  nasa_earth_imagery: (_c, a) => nasaEarthImagery(a),
  nasa_epic: (_c, a) => nasaEpic(a),

  // ─── NewsAPI ──────────────────────────────────────────────────────────────
  news_get_top_headlines: (_c, a) => newsGetTopHeadlines(a),
  news_search_news: (_c, a) => newsSearchNews(a),
  news_get_sources: (_c, a) => newsGetSources(a),

  // ─── Numbers ──────────────────────────────────────────────────────────────
  number_fact: (_c, a) => numberFact(a),
  number_random: (_c, a) => numberRandom(a),

  // ─── OMDB ─────────────────────────────────────────────────────────────────
  omdb_search: (_c, a) => omdbSearch(a),
  omdb_get_by_title: (_c, a) => omdbGetByTitle(a),
  omdb_get_by_id: (_c, a) => omdbGetById(a),

  // ─── Open Exchange Rates ──────────────────────────────────────────────────
  forex_latest: (_c, a) => forexLatest(a),
  forex_historical: (_c, a) => forexHistorical(a),
  forex_currencies: (_c, a) => forexCurrencies(a),
  forex_convert: (_c, a) => forexConvert(a),

  // ─── OpenF1 ───────────────────────────────────────────────────────────────
  f1_sessions: (_c, a) => f1Sessions(a),
  f1_drivers: (_c, a) => f1Drivers(a),
  f1_positions: (_c, a) => f1Positions(a),
  f1_laps: (_c, a) => f1Laps(a),
  f1_pit_stops: (_c, a) => f1PitStops(a),
  f1_car_data: (_c, a) => f1CarData(a),
  f1_team_radio: (_c, a) => f1TeamRadio(a),
  f1_weather: (_c, a) => f1Weather(a),

  // ─── Open Library ─────────────────────────────────────────────────────────
  openlibrary_search: (_c, a) => openlibrarySearch(a),
  openlibrary_get_book: (_c, a) => openlibraryGetBook(a),
  openlibrary_get_edition: (_c, a) => openlibraryGetEdition(a),
  openlibrary_get_author: (_c, a) => openlibraryGetAuthor(a),
  openlibrary_author_works: (_c, a) => openlibraryAuthorWorks(a),
  openlibrary_trending: (_c, a) => openlibraryTrending(a),

  // ─── Open-Meteo ───────────────────────────────────────────────────────────
  weather_current: (_c, a) => weatherCurrent(a),
  weather_forecast: (_c, a) => weatherForecast(a),
  weather_hourly: (_c, a) => weatherHourly(a),

  // ─── Podcast Index ────────────────────────────────────────────────────────
  podcast_search: (_c, a) => podcastSearch(a),
  podcast_get_by_feed_url: (_c, a) => podcastGetByFeedUrl(a),
  podcast_get_episodes: (_c, a) => podcastGetEpisodes(a),
  podcast_search_episodes: (_c, a) => podcastSearchEpisodes(a),
  podcast_trending: (_c, a) => podcastTrending(a),
  podcast_recent_episodes: (_c, a) => podcastRecentEpisodes(a),

  // ─── PTV ──────────────────────────────────────────────────────────────────
  ptv_search: (_c, a) => ptvSearch(a),
  ptv_departures: (_c, a) => ptvDepartures(a),
  ptv_disruptions: (_c, a) => ptvDisruptions(a),
  ptv_stops_on_route: (_c, a) => ptvStopsOnRoute(a),
  ptv_route_directions: (_c, a) => ptvRouteDirections(a),

  // ─── Radio Browser ────────────────────────────────────────────────────────
  radio_search: (_c, a) => radioSearch(a),
  radio_by_country: (_c, a) => radioByCountry(a),
  radio_top_clicked: (_c, a) => radioTopClicked(a),
  radio_top_voted: (_c, a) => radioTopVoted(a),
  radio_by_tag: (_c, a) => radioByTag(a),
  radio_countries: (_c, a) => radioCountries(a),

  // ─── REST Countries ───────────────────────────────────────────────────────
  country_all: (_c, a) => countryAll(a),
  country_by_name: (_c, a) => countryByName(a),
  country_by_code: (_c, a) => countryByCode(a),
  country_by_region: (_c, a) => countryByRegion(a),
  country_by_currency: (_c, a) => countryByCurrency(a),
  country_by_language: (_c, a) => countryByLanguage(a),

  // ─── SeatGeek ─────────────────────────────────────────────────────────────
  seatgeek_search_events: (_c, a) => seatgeekSearchEvents(a),
  seatgeek_get_event: (_c, a) => seatgeekGetEvent(a),
  seatgeek_search_performers: (_c, a) => seatgeekSearchPerformers(a),
  seatgeek_get_performer: (_c, a) => seatgeekGetPerformer(a),
  seatgeek_search_venues: (_c, a) => seatgeekSearchVenues(a),
  seatgeek_get_venue: (_c, a) => seatgeekGetVenue(a),

  // ─── Setlist.fm ───────────────────────────────────────────────────────────
  setlistfm_search_artist: (_c, a) => setlistfmSearchArtist(a),
  setlistfm_artist_setlists: (_c, a) => setlistfmArtistSetlists(a),
  setlistfm_search_setlists: (_c, a) => setlistfmSearchSetlists(a),
  setlistfm_get_setlist: (_c, a) => setlistfmGetSetlist(a),

  // ─── Ticketmaster ─────────────────────────────────────────────────────────
  tm_search_events: (_c, a) => tmSearchEvents(a),
  tm_get_event: (_c, a) => tmGetEvent(a),
  tm_search_venues: (_c, a) => tmSearchVenues(a),
  tm_get_venue: (_c, a) => tmGetVenue(a),
  tm_search_attractions: (_c, a) => tmSearchAttractions(a),

  // ─── TMDB ─────────────────────────────────────────────────────────────────
  tmdb_search_movies: (_c, a) => tmdbSearchMovies(a),
  tmdb_search_tv: (_c, a) => tmdbSearchTv(a),
  tmdb_movie: (_c, a) => tmdbMovie(a),
  tmdb_tv: (_c, a) => tmdbTv(a),
  tmdb_trending: (_c, a) => tmdbTrending(a),
  tmdb_now_playing: (_c, a) => tmdbNowPlaying(a),
  tmdb_upcoming: (_c, a) => tmdbUpcoming(a),
  tmdb_popular_tv: (_c, a) => tmdbPopularTv(a),

  // ─── Tomorrow.io ──────────────────────────────────────────────────────────
  tomorrow_realtime: (_c, a) => tomorrowRealtime(a),
  tomorrow_forecast: (_c, a) => tomorrowForecast(a),
  tomorrow_history: (_c, a) => tomorrowHistory(a),

  // ─── Trivia ───────────────────────────────────────────────────────────────
  trivia_questions: (_c, a) => triviaQuestions(a),
  trivia_categories: (_c, a) => triviaCategories(a),

  // ─── Twitch ───────────────────────────────────────────────────────────────
  twitch_search_streams: (_c, a) => twitchSearchStreams(a),
  twitch_get_stream: (_c, a) => twitchGetStream(a),
  twitch_search_games: (_c, a) => twitchSearchGames(a),
  twitch_get_top_games: (_c, a) => twitchGetTopGames(a),
  twitch_get_clips: (_c, a) => twitchGetClips(a),
  twitch_get_channel_info: (_c, a) => twitchGetChannelInfo(a),
  twitch_get_schedule: (_c, a) => twitchGetSchedule(a),

  // ─── Wise ─────────────────────────────────────────────────────────────────
  wise_exchange_rates: (_c, a) => wiseExchangeRates(a),
  wise_profile: (_c, a) => wiseProfile(a),
  wise_accounts: (_c, a) => wiseAccounts(a),
  wise_create_quote: (_c, a) => wiseCreateQuote(a),

  // ─── Yelp ─────────────────────────────────────────────────────────────────
  yelp_search_businesses: (_c, a) => yelpSearchBusinesses(a),
  yelp_get_business: (_c, a) => yelpGetBusiness(a),
  yelp_get_reviews: (_c, a) => yelpGetReviews(a),
  yelp_search_events: (_c, a) => yelpSearchEvents(a),
  yelp_get_autocomplete: (_c, a) => yelpGetAutocomplete(a),
};

// ─── Server factory ─────────────────────────────────────────────────────────

export function createServer(): Server {
  const server = new Server(
    {
      name: "@unclick/mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  // LIST TOOLS
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      ...META_TOOLS,
      ...DIRECT_TOOLS,
    ];
    return { tools };
  });

  // CALL TOOL
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;

    try {
      // ── Meta tools ──────────────────────────────────────────────
      if (name === "unclick_search") {
        const results = searchTools(
          String(args.query ?? ""),
          args.category as string | undefined
        );
        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No tools found matching "${args.query}". Try unclick_browse to see all available tools.`,
              },
            ],
          };
        }
        const text = results.map(formatToolSummary).join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} tool(s) matching "${args.query}":\n\n${text}`,
            },
          ],
        };
      }

      if (name === "unclick_browse") {
        const filtered = args.category
          ? CATALOG.filter((t) => t.category === args.category)
          : CATALOG;

        const byCategory = filtered.reduce<Record<string, ToolDef[]>>((acc, tool) => {
          (acc[tool.category] ??= []).push(tool);
          return acc;
        }, {});

        const lines: string[] = [];
        for (const [cat, tools] of Object.entries(byCategory)) {
          lines.push(`## ${cat.toUpperCase()}`);
          for (const tool of tools) {
            lines.push(`- **${tool.name}** (\`${tool.slug}\`) — ${tool.description}`);
          }
          lines.push("");
        }

        return {
          content: [
            {
              type: "text",
              text: `UnClick Tool Catalog (${filtered.length} tools)\n\n${lines.join("\n")}`,
            },
          ],
        };
      }

      if (name === "unclick_tool_info") {
        const slug = String(args.slug ?? "");
        const tool = TOOL_MAP.get(slug);
        if (!tool) {
          const available = CATALOG.map((t) => t.slug).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Tool "${slug}" not found. Available slugs: ${available}`,
              },
            ],
            isError: true,
          };
        }

        const lines: string[] = [
          `# ${tool.name}`,
          `**Slug:** ${tool.slug}  |  **Category:** ${tool.category}  |  **Scope:** ${tool.scope}`,
          "",
          tool.description,
          "",
          "## Endpoints",
        ];

        for (const ep of tool.endpoints) {
          lines.push(`### \`${ep.id}\` — ${ep.name}`);
          lines.push(ep.description);
          lines.push(`**Method:** ${ep.method}  |  **Path:** ${ep.path}`);
          lines.push(`**Input Schema:**`);
          lines.push("```json");
          lines.push(JSON.stringify(ep.inputSchema, null, 2));
          lines.push("```");
          lines.push("");
        }

        lines.push(
          `\n> Call any endpoint with: \`unclick_call\` → \`{ endpoint_id: "<id>", params: {...} }\``
        );

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      }

      if (name === "unclick_call") {
        const endpointId = String(args.endpoint_id ?? "");
        const params = (args.params ?? {}) as Record<string, unknown>;

        const entry = ENDPOINT_MAP.get(endpointId);
        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: `Endpoint "${endpointId}" not found. Use unclick_tool_info to see valid endpoint IDs.`,
              },
            ],
            isError: true,
          };
        }

        const client = createClient();
        const result = await client.call(entry.endpoint.method, entry.endpoint.path, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ── Direct tools ─────────────────────────────────────────────
      const handler = DIRECT_HANDLERS[name];
      if (handler) {
        const client = createClient();
        const result = await handler(client, args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is running — errors go to stderr so they don't corrupt the MCP stream
  process.stderr.write("UnClick MCP server running on stdio\n");
}
