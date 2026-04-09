// tool-wiring.ts
// Auto-generated wiring for all tool files.
// Exports ADDITIONAL_TOOLS and ADDITIONAL_HANDLERS to be merged into server.ts.

// ─── Gaming ───────────────────────────────────────────────────────────────────
import {
  rawgSearchGames, rawgGetGame, rawgGetGameScreenshots,
  rawgListGenres, rawgListPlatforms, rawgUpcomingGames,
} from "./rawg-tool.js";

import {
  riotSummoner, riotRanked, riotMatchHistory,
  riotGetMatch, riotValorantAccount,
} from "./riot-tool.js";

import {
  bungieSearchPlayer, bungieGetProfile,
  bungieGetManifest, bungieSearchEntities,
} from "./bungie-tool.js";

import {
  cocPlayer, cocClan, cocClanMembers,
  crPlayer, crTopPlayers,
  bsPlayer, bsClub,
} from "./supercell-tool.js";

import {
  legoSearchSets, legoGetSet, legoSetParts,
  legoSearchParts, legoThemes,
  bricksetSearch, bricksetGetSet,
} from "./lego-tool.js";

import {
  untappdSearchBeer, untappdGetBeer, untappdGetBrewery,
  untappdSearchBrewery, untappdBeerActivities,
} from "./untappd-tool.js";

import {
  esportsMatches, esportsTournaments, esportsTeams,
  esportsPlayers, esportsGetMatch,
} from "./pandascore-tool.js";

// ─── Australian / Local ───────────────────────────────────────────────────────
import {
  getAmberSites, getAmberCurrentPrice, getAmberForecast,
} from "./amber-tool.js";

import {
  getWillyweatherForecast, getWillyweatherSurf, getWillyweatherTide,
} from "./willyweather-tool.js";

import {
  searchDomainListings, getDomainProperty, getDomainSuburbStats,
} from "./domain-tool.js";

import {
  searchTrove, getTroveWork, getTroveNewspaperArticle,
} from "./trove-tool.js";

import {
  trackAuspostParcel, getAuspostPostcode, getAuspostDeliveryTimes,
} from "./australiapost-tool.js";

import {
  getSendleQuote, createSendleOrder, trackSendleParcel,
} from "./sendle-tool.js";

import {
  searchTrademarks, getTrademarkDetails, searchPatents,
} from "./ipaustralia-tool.js";

import {
  getTabMeetings, getTabRace, getTabSportsMarkets,
} from "./tab-tool.js";

import {
  getLottResults, getLottJackpots,
} from "./thelott-tool.js";

import { abnLookup, abnSearch } from "./abn-tool.js";

import {
  ptvSearch, ptvDepartures, ptvDisruptions,
  ptvStopsOnRoute, ptvRouteDirections,
} from "./ptv-tool.js";

// ─── Security ─────────────────────────────────────────────────────────────────
import {
  getCveDetail, searchCve, getRecentCves,
} from "./nvd-tool.js";

import { findEmail, verifyEmail, getDomainInfo } from "./hunter-tool.js";

import {
  checkAccountBreaches, getAllBreaches, checkPassword,
} from "./haveibeenpwned-tool.js";

import {
  scanUrlVirustotal, getUrlReport,
  scanIpVirustotal, scanDomainVirustotal,
} from "./virustotal-tool.js";

import {
  checkIpAbuse, reportIpAbuse, getBlacklistAbuseipdb,
} from "./abuseipdb-tool.js";

import {
  scanUrlUrlscan, getScanResult, searchUrlscan,
} from "./urlscan-tool.js";

import {
  searchShodan, getHostInfo, getShodanStats,
} from "./shodan-tool.js";

// ─── Dev / Infra ──────────────────────────────────────────────────────────────
import {
  sendEmailResend, getEmailResend, listDomainsResend,
} from "./resend-tool.js";

import {
  listVercelDeployments, getVercelDeployment,
  listVercelProjects, getVercelDomain, getVercelEnv,
} from "./vercel-tool.js";

import {
  getTogglTimeEntries, createTimeEntryToggl,
  getTogglProjects, getTogglSummary,
} from "./toggl-tool.js";

// ─── Email ────────────────────────────────────────────────────────────────────
import {
  sendEmail, readInbox, searchEmail,
  getEmail, markRead, deleteEmail, emailAction,
} from "./email-tool.js";

// ─── Environment / Science ────────────────────────────────────────────────────
import {
  getRecentEarthquakes, getEarthquakeDetail,
  getEarthquakesByRegion, usgsAction,
} from "./usgs-tool.js";

import {
  getAirQuality, getAirMeasurements,
  getAqCountries, openaqAction,
} from "./openaq-tool.js";

import {
  searchFoodProducts, getFoodProduct,
  getFoodByCategory, openFoodFactsAction,
} from "./openfoodfacts-tool.js";

import {
  getRecentObservations, getNotableObservations,
  getSpeciesInfo, ebirdAction,
} from "./ebird-tool.js";

import {
  estimateFlightEmissions, estimateVehicleEmissions,
  estimateElectricityEmissions, carbonInterfaceAction,
} from "./carboninterface-tool.js";

import { findNearestToilets, getToiletDetails } from "./toilets-tool.js";

// ─── Utilities ────────────────────────────────────────────────────────────────
import {
  calculateTip, calculateMortgage, calculateBmi,
  calculateCompoundInterest, convertCurrencyEstimate,
} from "./calculator-tool.js";

import {
  convertLength, convertWeight, convertTemperature,
  convertVolume, convertSpeed, convertArea, convertDataStorage,
} from "./unit-converter-tool.js";

import {
  getCurrentTime, convertTimezone, calculateDateDiff,
  addToDate, getBusinessDays, formatDate, getWeekNumber,
} from "./datetime-tool.js";

import {
  analyseText, transformText, extractEmails, extractUrls,
  extractPhoneNumbers, countOccurrences, truncateText,
} from "./text-tool.js";

import {
  searchMeals, getRandomMeal, getMealById,
  listMealCategories, filterMealsByCategory,
  filterMealsByArea, filterMealsByIngredient,
} from "./meal-tool.js";

import {
  getNflScores, getNbaScores, getMlbScores,
  getNhlScores, getSoccerScores, getEspnNews, getTeamInfo,
} from "./espn-tool.js";

import {
  getNflState, getSleeperPlayers, getTrendingPlayers,
  getSleeperLeague, getLeagueRosters, getLeagueMatchups,
} from "./sleeper-tool.js";

import {
  searchDeezer, getDeezerArtist, getDeezerAlbum,
  getDeezerTrack, getDeezerChart, searchDeezerPlaylist,
} from "./deezer-tool.js";

import {
  convertColor, getColorInfo, generateColorPalette,
  mixColors, checkContrastRatio,
} from "./color-tool.js";

import {
  generateUuid, generateRandomNumber, generateRandomString,
  pickRandomFromList, flipCoin, rollDice,
  shuffleList, generateLoremIpsum,
} from "./random-tool.js";

// ─── Productivity ─────────────────────────────────────────────────────────────
import { notionAction } from "./notion-tool.js";
import { readwiseAction } from "./readwise-tool.js";
import { raindropAction } from "./raindrop-tool.js";
import { clockifyAction } from "./clockify-tool.js";
import { splitwiseAction } from "./splitwise-tool.js";
import { instapaperAction } from "./instapaper-tool.js";
import { monicaAction } from "./monica-tool.js";
import { feedlyAction } from "./feedly-tool.js";

// ─── Existing tools (previously unwired) ─────────────────────────────────────
import {
  hnTopStories, hnNewStories, hnBestStories,
  hnAskHn, hnShowHn, hnItem, hnUser,
} from "./hackernews-tool.js";

import {
  f1Sessions, f1Drivers, f1Positions, f1Laps,
  f1PitStops, f1CarData, f1TeamRadio, f1Weather,
} from "./openf1-tool.js";

import {
  tmdbSearchMovies, tmdbSearchTv, tmdbMovie, tmdbTv,
  tmdbTrending, tmdbNowPlaying, tmdbUpcoming, tmdbPopularTv,
} from "./tmdb-tool.js";

import { triviaQuestions, triviaCategories } from "./trivia-tool.js";

import {
  nasaApod, nasaAsteroids, nasaMarsPhotos,
  nasaEarthImagery, nasaEpic,
} from "./nasa-tool.js";

import {
  weatherCurrent, weatherForecast, weatherHourly,
} from "./openmeteo-tool.js";

import {
  radioSearch, radioByCountry, radioTopClicked,
  radioTopVoted, radioByTag, radioCountries,
} from "./radiobrowser-tool.js";

import { numberFact, numberRandom } from "./numbers-tool.js";

import { omdbSearch, omdbGetByTitle, omdbGetById } from "./omdb-tool.js";

import {
  openlibrarySearch, openlibraryGetBook, openlibraryGetEdition,
  openlibraryGetAuthor, openlibraryAuthorWorks, openlibraryTrending,
} from "./openlibrary-tool.js";

import {
  mbSearchArtists, mbSearchReleases, mbSearchRecordings,
  mbGetArtist, mbGetRelease,
} from "./musicbrainz-tool.js";

import {
  geniusSearch, geniusGetSong, geniusGetArtist, geniusArtistSongs,
} from "./genius-tool.js";

import {
  tmSearchEvents, tmGetEvent, tmSearchVenues,
  tmGetVenue, tmSearchAttractions,
} from "./ticketmaster-tool.js";

import {
  seatgeekSearchEvents, seatgeekGetEvent,
  seatgeekSearchPerformers, seatgeekGetPerformer,
  seatgeekSearchVenues, seatgeekGetVenue,
} from "./seatgeek-tool.js";

import {
  eventbriteSearchEvents, eventbriteGetEvent,
  eventbriteGetEventAttendees, eventbriteCreateEvent,
  eventbriteListCategories, eventbriteGetVenue,
} from "./eventbrite-tool.js";

import {
  foursquareSearchPlaces, foursquareGetPlace,
  foursquareGetPhotos, foursquareGetTips, foursquareAutocomplete,
} from "./foursquare-tool.js";

import {
  lastfmGetArtistInfo, lastfmSearchArtists, lastfmGetTopTracks,
  lastfmGetSimilarArtists, lastfmGetChartTopArtists,
  lastfmGetChartTopTracks, lastfmGetAlbumInfo,
} from "./lastfm-tool.js";

import {
  discogsSearchReleases, discogsGetRelease, discogsGetArtist,
  discogsSearchArtists, discogsGetMarketplaceStats, discogsGetLabel,
} from "./discogs-tool.js";

import {
  setlistfmSearchArtist, setlistfmArtistSetlists,
  setlistfmSearchSetlists, setlistfmGetSetlist,
} from "./setlistfm-tool.js";

import {
  bandsintownArtist, bandsintownEvents, bandsintownRecommended,
} from "./bandsintown-tool.js";

import {
  podcastSearch, podcastGetByFeedUrl, podcastGetEpisodes,
  podcastSearchEpisodes, podcastTrending, podcastRecentEpisodes,
} from "./podcastindex-tool.js";

import {
  lichessUser, lichessUserGames, lichessPuzzleDaily,
  lichessTopPlayers, lichessTournament,
} from "./lichess-tool.js";

import {
  chessPlayer, chessPlayerStats, chessPlayerGames,
  chessPuzzlesRandom, chessLeaderboards,
} from "./chessdotcom-tool.js";

import {
  fplBootstrap, fplPlayer, fplGameweek,
  fplFixtures, fplMyTeam, fplManager, fplLeaguesClassic,
} from "./fpl-tool.js";

import {
  guardianSearchArticles, guardianGetArticle,
  guardianGetSections, guardianGetTags, guardianGetEdition,
} from "./guardian-tool.js";

import {
  newsGetTopHeadlines, newsSearchNews, newsGetSources,
} from "./newsapi-tool.js";

import {
  stockQuote, stockSearch, stockDaily,
  stockIntraday, forexRate, cryptoDaily,
} from "./alphavantage-tool.js";

import {
  cryptoPrice, cryptoCoin, cryptoSearch,
  cryptoTrending, cryptoTopCoins, cryptoCoinHistory,
} from "./coingecko-tool.js";

import {
  cmcListings, cmcQuotes, cmcInfo,
  cmcTrending, cmcGlobalMetrics,
} from "./coinmarketcap-tool.js";

import {
  forexLatest, forexHistorical, forexCurrencies, forexConvert,
} from "./openexchangerates-tool.js";

import {
  wiseExchangeRates, wiseProfile, wiseAccounts, wiseCreateQuote,
} from "./wise-tool.js";

import { ipLookup, ipBatch } from "./ipapi-tool.js";

import {
  countryAll, countryByName, countryByCode,
  countryByRegion, countryByCurrency, countryByLanguage,
} from "./restcountries-tool.js";

import {
  tomorrowRealtime, tomorrowForecast, tomorrowHistory,
} from "./tomorrowio-tool.js";

import {
  twitchSearchStreams, twitchGetStream, twitchSearchGames,
  twitchGetTopGames, twitchGetClips,
  twitchGetChannelInfo, twitchGetSchedule,
} from "./twitch-tool.js";

import {
  redditRead, redditPost, redditComment,
  redditSearch, redditUser, redditVote, redditSubscribe,
} from "./reddit-tool.js";

import { mastodonAction } from "./mastodon-tool.js";
import { blueskyAction } from "./bluesky-tool.js";

import {
  discordSend, discordRead, discordThread,
  discordReact, discordChannels, discordMembers, discordSearch,
} from "./discord-tool.js";

import { slackAction } from "./slack-tool.js";

import {
  telegramSend, telegramRead, telegramSearch,
  telegramSendMedia, telegramGetUpdates, telegramManageChat,
} from "./telegram-tool.js";

import {
  amazonSearch, amazonProduct, amazonBrowse, amazonVariations,
} from "./amazon-tool.js";

import {
  shopifyProducts, shopifyOrders, shopifyCustomers,
  shopifyInventory, shopifyCollections,
  shopifyShop, shopifyFulfillments,
} from "./shopify-tool.js";

import {
  yelpSearchBusinesses, yelpGetBusiness, yelpGetReviews,
  yelpSearchEvents, yelpGetAutocomplete,
} from "./yelp-tool.js";

import {
  xeroInvoices, xeroContacts, xeroAccounts, xeroPayments,
  xeroBankTransactions, xeroReports, xeroQuotes, xeroOrganisation,
} from "./xero-tool.js";

import { csuitAnalyze } from "./csuite-tool.js";
import { vaultAction } from "./vault-tool.js";

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL_TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const ADDITIONAL_TOOLS = [

  // ── rawg-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "rawg_search_games",
    description: "Search for video games on RAWG.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Search query" },
        genres: { type: "string" },
        platforms: { type: "string" },
        ordering: { type: "string" },
        page_size: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["search"],
    },
  },
  {
    name: "rawg_get_game",
    description: "Get details for a specific game by RAWG ID or slug.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "RAWG game ID or slug" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "rawg_game_screenshots",
    description: "Get screenshots for a RAWG game.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "rawg_list_genres",
    description: "List all game genres on RAWG.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },
  {
    name: "rawg_list_platforms",
    description: "List all gaming platforms on RAWG.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },
  {
    name: "rawg_upcoming_games",
    description: "Get upcoming game releases from RAWG.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_size: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },

  // ── riot-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "riot_summoner",
    description: "Get a League of Legends summoner by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        summonerName: { type: "string" },
        region: { type: "string", description: "e.g. euw1, na1, kr" },
        api_key: { type: "string" },
      },
      required: ["summonerName"],
    },
  },
  {
    name: "riot_ranked",
    description: "Get ranked stats for a League of Legends summoner.",
    inputSchema: {
      type: "object" as const,
      properties: {
        summonerId: { type: "string" },
        region: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["summonerId"],
    },
  },
  {
    name: "riot_match_history",
    description: "Get match history for a LoL/Riot account by PUUID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        puuid: { type: "string" },
        region: { type: "string" },
        count: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["puuid"],
    },
  },
  {
    name: "riot_get_match",
    description: "Get details for a specific Riot match by match ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        matchId: { type: "string" },
        region: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["matchId"],
    },
  },
  {
    name: "riot_valorant_account",
    description: "Get a Valorant account by game name and tag line.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gameName: { type: "string" },
        tagLine: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["gameName", "tagLine"],
    },
  },

  // ── bungie-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "bungie_search_player",
    description: "Search for a Destiny 2 player by display name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        displayName: { type: "string" },
        membershipType: { type: "number", description: "-1 for all" },
        api_key: { type: "string" },
      },
      required: ["displayName"],
    },
  },
  {
    name: "bungie_get_profile",
    description: "Get a Destiny 2 player profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        membershipType: { type: "number" },
        membershipId: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["membershipType", "membershipId"],
    },
  },
  {
    name: "bungie_get_manifest",
    description: "Get the Destiny 2 manifest definition.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },
  {
    name: "bungie_search_entities",
    description: "Search Destiny 2 manifest entities.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entityType: { type: "string" },
        searchTerm: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["entityType", "searchTerm"],
    },
  },

  // ── supercell-tool.ts ────────────────────────────────────────────────────────
  {
    name: "coc_player",
    description: "Get a Clash of Clans player by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        playerTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["playerTag"],
    },
  },
  {
    name: "coc_clan",
    description: "Get a Clash of Clans clan by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        clanTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["clanTag"],
    },
  },
  {
    name: "coc_clan_members",
    description: "Get members of a Clash of Clans clan.",
    inputSchema: {
      type: "object" as const,
      properties: {
        clanTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["clanTag"],
    },
  },
  {
    name: "cr_player",
    description: "Get a Clash Royale player by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        playerTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["playerTag"],
    },
  },
  {
    name: "cr_top_players",
    description: "Get top Clash Royale players globally or by location.",
    inputSchema: {
      type: "object" as const,
      properties: {
        locationId: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "bs_player",
    description: "Get a Brawl Stars player by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        playerTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["playerTag"],
    },
  },
  {
    name: "bs_club",
    description: "Get a Brawl Stars club by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        clubTag: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["clubTag"],
    },
  },

  // ── lego-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "lego_search_sets",
    description: "Search LEGO sets by name/theme (Rebrickable).",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" },
        theme_id: { type: "number" },
        min_year: { type: "number" },
        max_year: { type: "number" },
        page_size: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "lego_get_set",
    description: "Get details for a specific LEGO set by set number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        set_num: { type: "string", description: "e.g. 75192-1" },
        api_key: { type: "string" },
      },
      required: ["set_num"],
    },
  },
  {
    name: "lego_set_parts",
    description: "Get the parts list for a LEGO set.",
    inputSchema: {
      type: "object" as const,
      properties: {
        set_num: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["set_num"],
    },
  },
  {
    name: "lego_search_parts",
    description: "Search LEGO parts by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["search"],
    },
  },
  {
    name: "lego_themes",
    description: "List all LEGO themes from Rebrickable.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },
  {
    name: "brickset_search",
    description: "Search LEGO sets via Brickset API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        year: { type: "string" },
        theme: { type: "string" },
        pageSize: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "brickset_get_set",
    description: "Get a specific LEGO set from Brickset by set number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        setNumber: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["setNumber"],
    },
  },

  // ── untappd-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "untappd_search_beer",
    description: "Search for beers on Untappd.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "untappd_get_beer",
    description: "Get details for a specific beer on Untappd.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bid: { type: "number", description: "Beer ID" },
        api_key: { type: "string" },
      },
      required: ["bid"],
    },
  },
  {
    name: "untappd_get_brewery",
    description: "Get details for a brewery on Untappd.",
    inputSchema: {
      type: "object" as const,
      properties: {
        brewery_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["brewery_id"],
    },
  },
  {
    name: "untappd_search_brewery",
    description: "Search for breweries on Untappd.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "untappd_beer_activities",
    description: "Get recent activity/check-ins for a beer on Untappd.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bid: { type: "number" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["bid"],
    },
  },

  // ── pandascore-tool.ts ───────────────────────────────────────────────────────
  {
    name: "esports_matches",
    description: "Get esports matches from PandaScore.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game: { type: "string", description: "e.g. lol, csgo, dota2" },
        status: { type: "string", description: "running, upcoming, past" },
        page: { type: "number" },
        per_page: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "esports_tournaments",
    description: "Get esports tournaments from PandaScore.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game: { type: "string" },
        status: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "esports_teams",
    description: "Search esports teams on PandaScore.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game: { type: "string" },
        search: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "esports_players",
    description: "Search esports players on PandaScore.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "esports_get_match",
    description: "Get details for a specific esports match by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        match_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["match_id"],
    },
  },

  // ── amber-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "amber_sites",
    description: "Get Amber Electric sites for the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },
  {
    name: "amber_current_price",
    description: "Get the current electricity price for an Amber site.",
    inputSchema: {
      type: "object" as const,
      properties: {
        site_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["site_id"],
    },
  },
  {
    name: "amber_forecast",
    description: "Get electricity price forecast for an Amber site.",
    inputSchema: {
      type: "object" as const,
      properties: {
        site_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["site_id"],
    },
  },

  // ── willyweather-tool.ts ─────────────────────────────────────────────────────
  {
    name: "willyweather_forecast",
    description: "Get weather forecast from WillyWeather for an Australian location.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location_id: { type: "number", description: "WillyWeather location ID" },
        days: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["location_id"],
    },
  },
  {
    name: "willyweather_surf",
    description: "Get surf report from WillyWeather.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location_id: { type: "number" },
        days: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["location_id"],
    },
  },
  {
    name: "willyweather_tide",
    description: "Get tide times from WillyWeather.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location_id: { type: "number" },
        days: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["location_id"],
    },
  },

  // ── domain-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "domain_search_listings",
    description: "Search Australian property listings on Domain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        suburb: { type: "string" },
        state: { type: "string" },
        postcode: { type: "string" },
        listingType: { type: "string", description: "Sale or Rent" },
        minBedrooms: { type: "number" },
        maxBedrooms: { type: "number" },
        minPrice: { type: "number" },
        maxPrice: { type: "number" },
        pageSize: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "domain_get_property",
    description: "Get details for a specific Domain property listing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        listing_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "domain_suburb_stats",
    description: "Get property market statistics for an Australian suburb.",
    inputSchema: {
      type: "object" as const,
      properties: {
        suburb: { type: "string" },
        state: { type: "string" },
        postcode: { type: "string" },
        propertyCategory: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["suburb", "state"],
    },
  },

  // ── trove-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "trove_search",
    description: "Search the National Library of Australia's Trove.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        zone: { type: "string", description: "e.g. newspaper, book" },
        n: { type: "number", description: "Number of results" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "trove_get_work",
    description: "Get a specific Trove work by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "trove_newspaper_article",
    description: "Get a specific Trove newspaper article by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ── australiapost-tool.ts ────────────────────────────────────────────────────
  {
    name: "auspost_track_parcel",
    description: "Track an Australia Post parcel by tracking number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tracking_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["tracking_id"],
    },
  },
  {
    name: "auspost_get_postcode",
    description: "Look up an Australian postcode or suburb.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Suburb name or postcode" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "auspost_delivery_times",
    description: "Get Australia Post estimated delivery times.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_postcode: { type: "string" },
        to_postcode: { type: "string" },
        service_code: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["from_postcode", "to_postcode"],
    },
  },

  // ── sendle-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "sendle_get_quote",
    description: "Get a shipping quote from Sendle.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pickup_suburb: { type: "string" },
        pickup_postcode: { type: "string" },
        pickup_country: { type: "string" },
        delivery_suburb: { type: "string" },
        delivery_postcode: { type: "string" },
        delivery_country: { type: "string" },
        weight_value: { type: "number" },
        weight_units: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["pickup_postcode", "delivery_postcode", "weight_value"],
    },
  },
  {
    name: "sendle_create_order",
    description: "Create a Sendle shipping order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sender: { type: "object" },
        receiver: { type: "object" },
        parcel_contents: { type: "array" },
        api_key: { type: "string" },
      },
      required: ["sender", "receiver"],
    },
  },
  {
    name: "sendle_track_parcel",
    description: "Track a Sendle parcel by tracking number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tracking_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["tracking_id"],
    },
  },

  // ── ipaustralia-tool.ts ──────────────────────────────────────────────────────
  {
    name: "search_trademarks",
    description: "Search Australian trademarks via IP Australia.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        status: { type: "string" },
        type: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_trademark_details",
    description: "Get details for a specific Australian trademark.",
    inputSchema: {
      type: "object" as const,
      properties: {
        applicationNumber: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["applicationNumber"],
    },
  },
  {
    name: "search_patents",
    description: "Search Australian patents via IP Australia.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        status: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },

  // ── tab-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "tab_meetings",
    description: "Get TAB race meetings for a date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        jurisdiction: { type: "string", description: "e.g. VIC, NSW" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tab_race",
    description: "Get TAB race details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        race_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["race_id"],
    },
  },
  {
    name: "tab_sports_markets",
    description: "Get TAB sports betting markets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
        competition: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },

  // ── thelott-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "lott_results",
    description: "Get Australian lottery results from The Lott.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game: { type: "string", description: "e.g. TattsLotto, Powerball" },
        draw_number: { type: "number" },
      },
    },
  },
  {
    name: "lott_jackpots",
    description: "Get current Australian lottery jackpots from The Lott.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ── abn-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "abn_lookup",
    description: "Look up an Australian Business Number (ABN).",
    inputSchema: {
      type: "object" as const,
      properties: {
        abn: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["abn"],
    },
  },
  {
    name: "abn_search",
    description: "Search for Australian businesses by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["name"],
    },
  },

  // ── ptv-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "ptv_search",
    description: "Search PTV stops, routes, or outlets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search_term: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["search_term"],
    },
  },
  {
    name: "ptv_departures",
    description: "Get PTV departures for a stop.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_type: { type: "number", description: "0=train,1=tram,2=bus,3=vline,4=night" },
        stop_id: { type: "number" },
        route_id: { type: "number" },
        max_results: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["route_type", "stop_id"],
    },
  },
  {
    name: "ptv_disruptions",
    description: "Get current PTV service disruptions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_types: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "ptv_stops_on_route",
    description: "Get stops on a PTV route.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_id: { type: "number" },
        route_type: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["route_id", "route_type"],
    },
  },
  {
    name: "ptv_route_directions",
    description: "Get directions for a PTV route.",
    inputSchema: {
      type: "object" as const,
      properties: {
        route_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["route_id"],
    },
  },

  // ── nvd-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "get_cve_detail",
    description: "Get details for a specific CVE by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cve_id: { type: "string", description: "e.g. CVE-2023-12345" },
      },
      required: ["cve_id"],
    },
  },
  {
    name: "search_cve",
    description: "Search the NVD CVE database.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string" },
        cvssV3Severity: { type: "string", description: "LOW, MEDIUM, HIGH, CRITICAL" },
        resultsPerPage: { type: "number" },
        startIndex: { type: "number" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_recent_cves",
    description: "Get recently published CVEs from NVD.",
    inputSchema: {
      type: "object" as const,
      properties: {
        resultsPerPage: { type: "number" },
      },
    },
  },

  // ── hunter-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "hunter_find_email",
    description: "Find email addresses for a domain using Hunter.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["domain"],
    },
  },
  {
    name: "hunter_verify_email",
    description: "Verify an email address with Hunter.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "hunter_domain_info",
    description: "Get email information for a domain from Hunter.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["domain"],
    },
  },

  // ── haveibeenpwned-tool.ts ───────────────────────────────────────────────────
  {
    name: "hibp_check_account",
    description: "Check if an email account has been in a data breach.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "hibp_all_breaches",
    description: "Get all breaches tracked by Have I Been Pwned.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string" },
      },
    },
  },
  {
    name: "hibp_check_password",
    description: "Check if a password has appeared in a data breach.",
    inputSchema: {
      type: "object" as const,
      properties: {
        password: { type: "string" },
      },
      required: ["password"],
    },
  },

  // ── virustotal-tool.ts ───────────────────────────────────────────────────────
  {
    name: "virustotal_scan_url",
    description: "Submit a URL for scanning on VirusTotal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "virustotal_url_report",
    description: "Get a VirusTotal report for a URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "virustotal_scan_ip",
    description: "Get a VirusTotal report for an IP address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "virustotal_scan_domain",
    description: "Get a VirusTotal report for a domain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["domain"],
    },
  },

  // ── abuseipdb-tool.ts ────────────────────────────────────────────────────────
  {
    name: "abuseipdb_check_ip",
    description: "Check if an IP address has been reported for abuse.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
        maxAgeInDays: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "abuseipdb_report_ip",
    description: "Report an abusive IP address to AbuseIPDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
        categories: { type: "string" },
        comment: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["ip", "categories"],
    },
  },
  {
    name: "abuseipdb_blacklist",
    description: "Get the AbuseIPDB blacklist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        confidenceMinimum: { type: "number" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },

  // ── urlscan-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "urlscan_scan",
    description: "Submit a URL for scanning on urlscan.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        visibility: { type: "string", description: "public, private, or unlisted" },
        api_key: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "urlscan_get_result",
    description: "Get the result of a urlscan.io scan by UUID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        uuid: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["uuid"],
    },
  },
  {
    name: "urlscan_search",
    description: "Search urlscan.io scan results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        size: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },

  // ── shodan-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "shodan_search",
    description: "Search Shodan for internet-connected devices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "shodan_host_info",
    description: "Get Shodan information for a specific IP address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "shodan_stats",
    description: "Get aggregated statistics for a Shodan query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        facets: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },

  // ── resend-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "resend_send_email",
    description: "Send an email using Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        subject: { type: "string" },
        html: { type: "string" },
        text: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["from", "to", "subject"],
    },
  },
  {
    name: "resend_get_email",
    description: "Get a sent email by ID from Resend.",
    inputSchema: {
      type: "object" as const,
      properties: {
        email_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["email_id"],
    },
  },
  {
    name: "resend_list_domains",
    description: "List domains configured in Resend.",
    inputSchema: {
      type: "object" as const,
      properties: { api_key: { type: "string" } },
    },
  },

  // ── vercel-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "vercel_list_deployments",
    description: "List Vercel deployments for a project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "vercel_get_deployment",
    description: "Get details for a specific Vercel deployment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        deploymentId: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["deploymentId"],
    },
  },
  {
    name: "vercel_list_projects",
    description: "List all Vercel projects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "vercel_get_domain",
    description: "Get information about a Vercel domain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["domain"],
    },
  },
  {
    name: "vercel_get_env",
    description: "Get environment variables for a Vercel project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["projectId"],
    },
  },

  // ── toggl-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "toggl_time_entries",
    description: "Get Toggl time entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "toggl_create_time_entry",
    description: "Create a new Toggl time entry.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_id: { type: "number" },
        description: { type: "string" },
        start: { type: "string" },
        stop: { type: "string" },
        project_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["workspace_id", "start"],
    },
  },
  {
    name: "toggl_projects",
    description: "Get Toggl projects for a workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["workspace_id"],
    },
  },
  {
    name: "toggl_summary",
    description: "Get a Toggl time summary report.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_id: { type: "number" },
        since: { type: "string" },
        until: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["workspace_id"],
    },
  },

  // ── email-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "email_send",
    description: "Send an email via Gmail/IMAP.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "string" },
        bcc: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "email_read_inbox",
    description: "Read emails from an inbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        folder: { type: "string" },
        limit: { type: "number" },
        email: { type: "string" },
        password: { type: "string" },
      },
    },
  },
  {
    name: "email_search",
    description: "Search emails in an inbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        folder: { type: "string" },
        limit: { type: "number" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "email_get",
    description: "Get a specific email by UID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        uid: { type: "string" },
        folder: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["uid"],
    },
  },
  {
    name: "email_mark_read",
    description: "Mark an email as read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        uid: { type: "string" },
        folder: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["uid"],
    },
  },
  {
    name: "email_delete",
    description: "Delete an email by UID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        uid: { type: "string" },
        folder: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["uid"],
    },
  },

  // ── usgs-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "usgs_recent_earthquakes",
    description: "Get recent earthquakes from USGS.",
    inputSchema: {
      type: "object" as const,
      properties: {
        minmagnitude: { type: "number" },
        limit: { type: "number" },
        period: { type: "string", description: "hour, day, week, month" },
      },
    },
  },
  {
    name: "usgs_earthquake_detail",
    description: "Get details for a specific USGS earthquake event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "usgs_earthquakes_by_region",
    description: "Get USGS earthquakes within a geographic region.",
    inputSchema: {
      type: "object" as const,
      properties: {
        minlatitude: { type: "number" },
        maxlatitude: { type: "number" },
        minlongitude: { type: "number" },
        maxlongitude: { type: "number" },
        minmagnitude: { type: "number" },
        starttime: { type: "string" },
        endtime: { type: "string" },
      },
      required: ["minlatitude", "maxlatitude", "minlongitude", "maxlongitude"],
    },
  },

  // ── openaq-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "openaq_air_quality",
    description: "Get air quality data for a location from OpenAQ.",
    inputSchema: {
      type: "object" as const,
      properties: {
        city: { type: "string" },
        country: { type: "string" },
        parameter: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "openaq_measurements",
    description: "Get air quality measurements from OpenAQ.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location_id: { type: "number" },
        parameter: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        limit: { type: "number" },
      },
      required: ["location_id"],
    },
  },
  {
    name: "openaq_countries",
    description: "List countries with air quality data on OpenAQ.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ── openfoodfacts-tool.ts ────────────────────────────────────────────────────
  {
    name: "food_search",
    description: "Search for food products on Open Food Facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        page_size: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "food_get_product",
    description: "Get a food product from Open Food Facts by barcode.",
    inputSchema: {
      type: "object" as const,
      properties: {
        barcode: { type: "string" },
      },
      required: ["barcode"],
    },
  },
  {
    name: "food_by_category",
    description: "Get food products by category from Open Food Facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string" },
        page: { type: "number" },
      },
      required: ["category"],
    },
  },

  // ── ebird-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "ebird_recent_observations",
    description: "Get recent bird observations from eBird.",
    inputSchema: {
      type: "object" as const,
      properties: {
        regionCode: { type: "string", description: "e.g. AU-VIC" },
        back: { type: "number", description: "Days back (max 30)" },
        maxResults: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["regionCode"],
    },
  },
  {
    name: "ebird_notable_observations",
    description: "Get notable/rare bird observations from eBird.",
    inputSchema: {
      type: "object" as const,
      properties: {
        regionCode: { type: "string" },
        back: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["regionCode"],
    },
  },
  {
    name: "ebird_species_info",
    description: "Get information about a bird species from eBird.",
    inputSchema: {
      type: "object" as const,
      properties: {
        speciesCode: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["speciesCode"],
    },
  },

  // ── carboninterface-tool.ts ──────────────────────────────────────────────────
  {
    name: "carbon_flight_emissions",
    description: "Estimate carbon emissions for a flight.",
    inputSchema: {
      type: "object" as const,
      properties: {
        legs: { type: "array", description: "Array of flight legs with departure_airport and destination_airport" },
        passengers: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["legs"],
    },
  },
  {
    name: "carbon_vehicle_emissions",
    description: "Estimate carbon emissions for a vehicle journey.",
    inputSchema: {
      type: "object" as const,
      properties: {
        distance_value: { type: "number" },
        distance_unit: { type: "string" },
        vehicle_model_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["distance_value", "vehicle_model_id"],
    },
  },
  {
    name: "carbon_electricity_emissions",
    description: "Estimate carbon emissions for electricity consumption.",
    inputSchema: {
      type: "object" as const,
      properties: {
        electricity_value: { type: "number" },
        electricity_unit: { type: "string" },
        country: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["electricity_value", "country"],
    },
  },

  // ── toilets-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "find_nearest_toilets",
    description: "Find the nearest public toilets to a location (Australia).",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        radius: { type: "number", description: "Search radius in metres" },
        limit: { type: "number" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "get_toilet_details",
    description: "Get details for a specific public toilet by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        toilet_id: { type: "string" },
      },
      required: ["toilet_id"],
    },
  },

  // ── calculator-tool.ts ───────────────────────────────────────────────────────
  {
    name: "calc_tip",
    description: "Calculate tip amount and total for a bill.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bill: { type: "number" },
        tip_percent: { type: "number" },
        split: { type: "number" },
      },
      required: ["bill"],
    },
  },
  {
    name: "calc_mortgage",
    description: "Calculate monthly mortgage repayment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        principal: { type: "number" },
        annual_rate: { type: "number" },
        years: { type: "number" },
      },
      required: ["principal", "annual_rate", "years"],
    },
  },
  {
    name: "calc_bmi",
    description: "Calculate Body Mass Index (BMI).",
    inputSchema: {
      type: "object" as const,
      properties: {
        weight_kg: { type: "number" },
        height_cm: { type: "number" },
      },
      required: ["weight_kg", "height_cm"],
    },
  },
  {
    name: "calc_compound_interest",
    description: "Calculate compound interest growth.",
    inputSchema: {
      type: "object" as const,
      properties: {
        principal: { type: "number" },
        annual_rate: { type: "number" },
        years: { type: "number" },
        compounds_per_year: { type: "number" },
        monthly_contribution: { type: "number" },
      },
      required: ["principal", "annual_rate", "years"],
    },
  },
  {
    name: "calc_currency_estimate",
    description: "Estimate currency conversion using a rough rate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["amount", "from", "to"],
    },
  },

  // ── unit-converter-tool.ts ───────────────────────────────────────────────────
  {
    name: "convert_length",
    description: "Convert between length units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_weight",
    description: "Convert between weight/mass units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_temperature",
    description: "Convert between temperature units (C, F, K).",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_volume",
    description: "Convert between volume units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_speed",
    description: "Convert between speed units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_area",
    description: "Convert between area units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "convert_data_storage",
    description: "Convert between data storage units.",
    inputSchema: {
      type: "object" as const,
      properties: {
        value: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["value", "from", "to"],
    },
  },

  // ── datetime-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "datetime_current_time",
    description: "Get the current date and time, optionally in a specific timezone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timezone: { type: "string" },
        format: { type: "string" },
      },
    },
  },
  {
    name: "datetime_convert_timezone",
    description: "Convert a datetime from one timezone to another.",
    inputSchema: {
      type: "object" as const,
      properties: {
        datetime: { type: "string" },
        from_timezone: { type: "string" },
        to_timezone: { type: "string" },
      },
      required: ["datetime", "from_timezone", "to_timezone"],
    },
  },
  {
    name: "datetime_date_diff",
    description: "Calculate the difference between two dates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date1: { type: "string" },
        date2: { type: "string" },
      },
      required: ["date1", "date2"],
    },
  },
  {
    name: "datetime_add_to_date",
    description: "Add a duration to a date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
        years: { type: "number" },
        months: { type: "number" },
        days: { type: "number" },
        hours: { type: "number" },
        minutes: { type: "number" },
      },
      required: ["date"],
    },
  },
  {
    name: "datetime_business_days",
    description: "Get business days between two dates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start: { type: "string" },
        end: { type: "string" },
      },
      required: ["start", "end"],
    },
  },
  {
    name: "datetime_format_date",
    description: "Format a date string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
        format: { type: "string" },
        locale: { type: "string" },
      },
      required: ["date"],
    },
  },
  {
    name: "datetime_week_number",
    description: "Get the ISO week number for a date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
      },
      required: ["date"],
    },
  },

  // ── text-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "text_analyse",
    description: "Analyse text (word count, sentences, readability).",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "text_transform",
    description: "Transform text (uppercase, lowercase, title case, slug, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        transform: { type: "string", description: "uppercase, lowercase, titlecase, slug, reverse, etc." },
      },
      required: ["text", "transform"],
    },
  },
  {
    name: "text_extract_emails",
    description: "Extract all email addresses from a text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "text_extract_urls",
    description: "Extract all URLs from a text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "text_extract_phone_numbers",
    description: "Extract all phone numbers from a text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "text_count_occurrences",
    description: "Count occurrences of a substring in text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        search: { type: "string" },
        case_sensitive: { type: "boolean" },
      },
      required: ["text", "search"],
    },
  },
  {
    name: "text_truncate",
    description: "Truncate text to a maximum length.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        max_length: { type: "number" },
        suffix: { type: "string" },
      },
      required: ["text", "max_length"],
    },
  },

  // ── meal-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "meal_search",
    description: "Search for meals/recipes by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "meal_random",
    description: "Get a random meal/recipe.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "meal_get_by_id",
    description: "Get a meal/recipe by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "meal_categories",
    description: "List all meal categories.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "meal_filter_by_category",
    description: "Filter meals by category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string" },
      },
      required: ["category"],
    },
  },
  {
    name: "meal_filter_by_area",
    description: "Filter meals by cuisine/area.",
    inputSchema: {
      type: "object" as const,
      properties: {
        area: { type: "string" },
      },
      required: ["area"],
    },
  },
  {
    name: "meal_filter_by_ingredient",
    description: "Filter meals by main ingredient.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ingredient: { type: "string" },
      },
      required: ["ingredient"],
    },
  },

  // ── espn-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "espn_nfl_scores",
    description: "Get current NFL scores from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "espn_nba_scores",
    description: "Get current NBA scores from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "espn_mlb_scores",
    description: "Get current MLB scores from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "espn_nhl_scores",
    description: "Get current NHL scores from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "espn_soccer_scores",
    description: "Get soccer scores from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league: { type: "string", description: "e.g. eng.1, usa.1" },
      },
    },
  },
  {
    name: "espn_news",
    description: "Get ESPN sports news.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "espn_team_info",
    description: "Get team information from ESPN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
        league: { type: "string" },
        team_id: { type: "string" },
      },
      required: ["sport", "league", "team_id"],
    },
  },

  // ── sleeper-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "sleeper_nfl_state",
    description: "Get the current NFL state from Sleeper.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "sleeper_players",
    description: "Get all NFL players from Sleeper.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
      },
    },
  },
  {
    name: "sleeper_trending_players",
    description: "Get trending players on Sleeper.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
        type: { type: "string", description: "add or drop" },
        lookback_hours: { type: "number" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "sleeper_league",
    description: "Get a Sleeper fantasy league by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "string" },
      },
      required: ["league_id"],
    },
  },
  {
    name: "sleeper_league_rosters",
    description: "Get rosters for a Sleeper fantasy league.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "string" },
      },
      required: ["league_id"],
    },
  },
  {
    name: "sleeper_league_matchups",
    description: "Get matchups for a Sleeper fantasy league week.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "string" },
        week: { type: "number" },
      },
      required: ["league_id", "week"],
    },
  },

  // ── deezer-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "deezer_search",
    description: "Search Deezer for tracks, artists, or albums.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        type: { type: "string", description: "track, artist, album, playlist" },
        limit: { type: "number" },
      },
      required: ["q"],
    },
  },
  {
    name: "deezer_get_artist",
    description: "Get a Deezer artist by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "deezer_get_album",
    description: "Get a Deezer album by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "deezer_get_track",
    description: "Get a Deezer track by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "deezer_chart",
    description: "Get Deezer chart (top tracks/albums/artists).",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "tracks, albums, artists, playlists" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "deezer_search_playlist",
    description: "Search for Deezer playlists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        limit: { type: "number" },
      },
      required: ["q"],
    },
  },

  // ── color-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "color_convert",
    description: "Convert a color between HEX, RGB, HSL, and other formats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        color: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["color", "from", "to"],
    },
  },
  {
    name: "color_info",
    description: "Get information about a color (name, complementary, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        color: { type: "string" },
        format: { type: "string" },
      },
      required: ["color"],
    },
  },
  {
    name: "color_palette",
    description: "Generate a color palette from a base color.",
    inputSchema: {
      type: "object" as const,
      properties: {
        color: { type: "string" },
        type: { type: "string", description: "complementary, analogous, triadic, etc." },
        count: { type: "number" },
      },
      required: ["color"],
    },
  },
  {
    name: "color_mix",
    description: "Mix two colors together.",
    inputSchema: {
      type: "object" as const,
      properties: {
        color1: { type: "string" },
        color2: { type: "string" },
        ratio: { type: "number" },
      },
      required: ["color1", "color2"],
    },
  },
  {
    name: "color_contrast_ratio",
    description: "Check the contrast ratio between two colors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        foreground: { type: "string" },
        background: { type: "string" },
      },
      required: ["foreground", "background"],
    },
  },

  // ── random-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "random_uuid",
    description: "Generate a random UUID.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "random_number",
    description: "Generate a random number within a range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        min: { type: "number" },
        max: { type: "number" },
        count: { type: "number" },
        integer: { type: "boolean" },
      },
    },
  },
  {
    name: "random_string",
    description: "Generate a random string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        length: { type: "number" },
        charset: { type: "string" },
      },
    },
  },
  {
    name: "random_pick_from_list",
    description: "Pick random item(s) from a list.",
    inputSchema: {
      type: "object" as const,
      properties: {
        items: { type: "array" },
        count: { type: "number" },
      },
      required: ["items"],
    },
  },
  {
    name: "random_flip_coin",
    description: "Flip a coin.",
    inputSchema: {
      type: "object" as const,
      properties: {
        times: { type: "number" },
      },
    },
  },
  {
    name: "random_roll_dice",
    description: "Roll dice.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dice: { type: "string", description: "e.g. 2d6, 1d20" },
      },
    },
  },
  {
    name: "random_shuffle_list",
    description: "Shuffle a list randomly.",
    inputSchema: {
      type: "object" as const,
      properties: {
        items: { type: "array" },
      },
      required: ["items"],
    },
  },
  {
    name: "random_lorem_ipsum",
    description: "Generate lorem ipsum placeholder text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        paragraphs: { type: "number" },
        words: { type: "number" },
        sentences: { type: "number" },
      },
    },
  },

  // ── notion-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "notion_action",
    description: "Perform a Notion action: search_notion, get_notion_page, get_notion_database, query_notion_database, create_notion_page, update_notion_page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        query: { type: "string" },
        page_id: { type: "string" },
        database_id: { type: "string" },
        filter: { type: "object" },
        properties: { type: "object" },
        parent: { type: "object" },
      },
      required: ["action"],
    },
  },

  // ── readwise-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "readwise_action",
    description: "Perform a Readwise action: get_readwise_highlights, get_readwise_books, get_daily_review, search_highlights, create_highlight.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        query: { type: "string" },
        page: { type: "number" },
        book_id: { type: "number" },
        highlights: { type: "array" },
      },
      required: ["action"],
    },
  },

  // ── raindrop-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "raindrop_action",
    description: "Perform a Raindrop.io action: search_raindrops, get_collection_raindrops, get_raindrop_collections, create_raindrop, get_raindrop, delete_raindrop.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        search: { type: "string" },
        collection_id: { type: "number" },
        raindrop_id: { type: "number" },
        link: { type: "string" },
        title: { type: "string" },
        tags: { type: "array" },
      },
      required: ["action"],
    },
  },

  // ── clockify-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "clockify_action",
    description: "Perform a Clockify action: get_clockify_workspaces, get_time_entries, create_time_entry, get_clockify_projects, get_clockify_summary.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        workspace_id: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        project_id: { type: "string" },
        description: { type: "string" },
      },
      required: ["action"],
    },
  },

  // ── splitwise-tool.ts ────────────────────────────────────────────────────────
  {
    name: "splitwise_action",
    description: "Perform a Splitwise action: get_groups, get_expenses, get_balances, create_expense, get_friends.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        group_id: { type: "number" },
        description: { type: "string" },
        cost: { type: "string" },
        currency_code: { type: "string" },
        users: { type: "array" },
      },
      required: ["action"],
    },
  },

  // ── instapaper-tool.ts ───────────────────────────────────────────────────────
  {
    name: "instapaper_action",
    description: "Perform an Instapaper action: get_instapaper_bookmarks, add_instapaper_bookmark, archive_bookmark, delete_bookmark, get_instapaper_folders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
        bookmark_id: { type: "number" },
        url: { type: "string" },
        title: { type: "string" },
        folder_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["action"],
    },
  },

  // ── monica-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "monica_action",
    description: "Perform a Monica CRM action: get_contacts, search_contacts, get_contact, create_contact, get_contact_reminders, get_activities, add_note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        contact_id: { type: "number" },
        query: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        body: { type: "string" },
      },
      required: ["action"],
    },
  },

  // ── feedly-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "feedly_action",
    description: "Perform a Feedly action: get_feedly_feeds, get_feedly_streams, search_feedly, get_feedly_categories, mark_as_read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        api_key: { type: "string" },
        stream_id: { type: "string" },
        query: { type: "string" },
        count: { type: "number" },
        entry_ids: { type: "array" },
      },
      required: ["action"],
    },
  },

  // ── hackernews-tool.ts ───────────────────────────────────────────────────────
  {
    name: "hn_top_stories",
    description: "Get the top stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "hn_new_stories",
    description: "Get the newest stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "hn_best_stories",
    description: "Get the best stories from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "hn_ask_hn",
    description: "Get Ask HN posts from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "hn_show_hn",
    description: "Get Show HN posts from Hacker News.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "hn_item",
    description: "Get a specific Hacker News item by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
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
        username: { type: "string" },
      },
      required: ["username"],
    },
  },

  // ── openf1-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "f1_sessions",
    description: "Get Formula 1 sessions from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        year: { type: "number" },
        session_type: { type: "string" },
        country_name: { type: "string" },
      },
    },
  },
  {
    name: "f1_drivers",
    description: "Get Formula 1 driver info from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
      },
    },
  },
  {
    name: "f1_positions",
    description: "Get Formula 1 position data from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_laps",
    description: "Get Formula 1 lap data from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
        lap_number: { type: "number" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_pit_stops",
    description: "Get Formula 1 pit stop data from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_car_data",
    description: "Get Formula 1 car telemetry data from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
      },
      required: ["session_key", "driver_number"],
    },
  },
  {
    name: "f1_team_radio",
    description: "Get Formula 1 team radio messages from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
        driver_number: { type: "number" },
      },
      required: ["session_key"],
    },
  },
  {
    name: "f1_weather",
    description: "Get Formula 1 weather data from OpenF1.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_key: { type: "number" },
      },
      required: ["session_key"],
    },
  },

  // ── tmdb-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "tmdb_search_movies",
    description: "Search for movies on TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        year: { type: "number" },
        page: { type: "number" },
        api_key: { type: "string" },
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
        query: { type: "string" },
        page: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "tmdb_movie",
    description: "Get details for a TMDB movie by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "tmdb_tv",
    description: "Get details for a TMDB TV show by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "tmdb_trending",
    description: "Get trending movies or TV shows on TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        media_type: { type: "string", description: "movie, tv, or all" },
        time_window: { type: "string", description: "day or week" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tmdb_now_playing",
    description: "Get movies currently in theaters from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tmdb_upcoming",
    description: "Get upcoming movies from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tmdb_popular_tv",
    description: "Get popular TV shows from TMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },

  // ── trivia-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "trivia_questions",
    description: "Get trivia questions from Open Trivia DB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: { type: "number" },
        category: { type: "number" },
        difficulty: { type: "string", description: "easy, medium, hard" },
        type: { type: "string", description: "multiple, boolean" },
      },
    },
  },
  {
    name: "trivia_categories",
    description: "Get available trivia categories from Open Trivia DB.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ── nasa-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "nasa_apod",
    description: "Get NASA Astronomy Picture of the Day.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
        count: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "nasa_asteroids",
    description: "Get NASA Near Earth Object (asteroid) data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "nasa_mars_photos",
    description: "Get NASA Mars rover photos.",
    inputSchema: {
      type: "object" as const,
      properties: {
        rover: { type: "string", description: "curiosity, opportunity, spirit" },
        sol: { type: "number" },
        earth_date: { type: "string" },
        camera: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "nasa_earth_imagery",
    description: "Get NASA Earth satellite imagery.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lat: { type: "number" },
        lon: { type: "number" },
        date: { type: "string" },
        dim: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["lat", "lon"],
    },
  },
  {
    name: "nasa_epic",
    description: "Get NASA EPIC Earth imagery.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },

  // ── openmeteo-tool.ts ────────────────────────────────────────────────────────
  {
    name: "weather_current",
    description: "Get current weather for a location from Open-Meteo (no API key required).",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        timezone: { type: "string" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "weather_forecast",
    description: "Get weather forecast for a location from Open-Meteo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        days: { type: "number" },
        timezone: { type: "string" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "weather_hourly",
    description: "Get hourly weather forecast from Open-Meteo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
        days: { type: "number" },
        timezone: { type: "string" },
      },
      required: ["latitude", "longitude"],
    },
  },

  // ── radiobrowser-tool.ts ─────────────────────────────────────────────────────
  {
    name: "radio_search",
    description: "Search for radio stations via Radio Browser.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        limit: { type: "number" },
      },
      required: ["name"],
    },
  },
  {
    name: "radio_by_country",
    description: "Get radio stations by country.",
    inputSchema: {
      type: "object" as const,
      properties: {
        country: { type: "string" },
        limit: { type: "number" },
      },
      required: ["country"],
    },
  },
  {
    name: "radio_top_clicked",
    description: "Get the most-clicked radio stations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "radio_top_voted",
    description: "Get the most-voted radio stations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "radio_by_tag",
    description: "Get radio stations by genre tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag: { type: "string" },
        limit: { type: "number" },
      },
      required: ["tag"],
    },
  },
  {
    name: "radio_countries",
    description: "List all countries with radio stations.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ── numbers-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "number_fact",
    description: "Get an interesting fact about a number.",
    inputSchema: {
      type: "object" as const,
      properties: {
        number: { type: "number" },
        type: { type: "string", description: "trivia, math, date, year" },
      },
      required: ["number"],
    },
  },
  {
    name: "number_random",
    description: "Get a random number fact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string" },
        min: { type: "number" },
        max: { type: "number" },
      },
    },
  },

  // ── omdb-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "omdb_search",
    description: "Search movies/TV shows on OMDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        s: { type: "string", description: "Search term" },
        type: { type: "string" },
        y: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["s"],
    },
  },
  {
    name: "omdb_by_title",
    description: "Get an OMDB movie/show by title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        t: { type: "string" },
        type: { type: "string" },
        y: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["t"],
    },
  },
  {
    name: "omdb_by_id",
    description: "Get an OMDB movie/show by IMDb ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        i: { type: "string", description: "IMDb ID" },
        api_key: { type: "string" },
      },
      required: ["i"],
    },
  },

  // ── openlibrary-tool.ts ──────────────────────────────────────────────────────
  {
    name: "openlibrary_search",
    description: "Search books on Open Library.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        limit: { type: "number" },
        page: { type: "number" },
      },
      required: ["q"],
    },
  },
  {
    name: "openlibrary_get_book",
    description: "Get a book from Open Library by work ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        work_id: { type: "string", description: "e.g. OL45804W" },
      },
      required: ["work_id"],
    },
  },
  {
    name: "openlibrary_get_edition",
    description: "Get a book edition from Open Library by ISBN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        isbn: { type: "string" },
      },
      required: ["isbn"],
    },
  },
  {
    name: "openlibrary_get_author",
    description: "Get an author from Open Library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        author_id: { type: "string", description: "e.g. OL23919A" },
      },
      required: ["author_id"],
    },
  },
  {
    name: "openlibrary_author_works",
    description: "Get works by an author from Open Library.",
    inputSchema: {
      type: "object" as const,
      properties: {
        author_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["author_id"],
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

  // ── musicbrainz-tool.ts ──────────────────────────────────────────────────────
  {
    name: "mb_search_artists",
    description: "Search for artists on MusicBrainz.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_search_releases",
    description: "Search for releases/albums on MusicBrainz.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        artist: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_search_recordings",
    description: "Search for recordings/tracks on MusicBrainz.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        artist: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "mb_get_artist",
    description: "Get a MusicBrainz artist by MBID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        mbid: { type: "string" },
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
        mbid: { type: "string" },
      },
      required: ["mbid"],
    },
  },

  // ── genius-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "genius_search",
    description: "Search Genius for songs and lyrics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "genius_get_song",
    description: "Get a Genius song by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "genius_get_artist",
    description: "Get a Genius artist by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "genius_artist_songs",
    description: "Get songs by an artist on Genius.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        per_page: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ── ticketmaster-tool.ts ─────────────────────────────────────────────────────
  {
    name: "tm_search_events",
    description: "Search for events on Ticketmaster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string" },
        city: { type: "string" },
        countryCode: { type: "string" },
        classificationName: { type: "string" },
        startDateTime: { type: "string" },
        size: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tm_get_event",
    description: "Get details for a specific Ticketmaster event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        api_key: { type: "string" },
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
        keyword: { type: "string" },
        countryCode: { type: "string" },
        stateCode: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "tm_get_venue",
    description: "Get details for a specific Ticketmaster venue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "tm_search_attractions",
    description: "Search for attractions/artists on Ticketmaster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string" },
        classificationName: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },

  // ── seatgeek-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "seatgeek_search_events",
    description: "Search for events on SeatGeek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        type: { type: "string" },
        datetime_utc_gte: { type: "string" },
        per_page: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "seatgeek_get_event",
    description: "Get a SeatGeek event by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
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
        q: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "seatgeek_get_performer",
    description: "Get a SeatGeek performer by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
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
        q: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "seatgeek_get_venue",
    description: "Get a SeatGeek venue by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ── eventbrite-tool.ts ───────────────────────────────────────────────────────
  {
    name: "eventbrite_search_events",
    description: "Search for events on Eventbrite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        location_address: { type: "string" },
        start_date_range_start: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "eventbrite_get_event",
    description: "Get details for an Eventbrite event by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "eventbrite_get_attendees",
    description: "Get attendees for an Eventbrite event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "eventbrite_create_event",
    description: "Create an event on Eventbrite.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        start_utc: { type: "string" },
        end_utc: { type: "string" },
        timezone: { type: "string" },
        currency: { type: "string" },
        organizer_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["name", "start_utc", "end_utc", "timezone"],
    },
  },
  {
    name: "eventbrite_list_categories",
    description: "List Eventbrite event categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "eventbrite_get_venue",
    description: "Get details for an Eventbrite venue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        venue_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["venue_id"],
    },
  },

  // ── foursquare-tool.ts ───────────────────────────────────────────────────────
  {
    name: "foursquare_search_places",
    description: "Search for places on Foursquare.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        ll: { type: "string", description: "lat,lng" },
        near: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "foursquare_get_place",
    description: "Get details for a Foursquare place by FSQ ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fsq_id: { type: "string" },
        api_key: { type: "string" },
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
        fsq_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["fsq_id"],
    },
  },
  {
    name: "foursquare_get_tips",
    description: "Get tips/reviews for a Foursquare place.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fsq_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["fsq_id"],
    },
  },
  {
    name: "foursquare_autocomplete",
    description: "Autocomplete a Foursquare place search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        ll: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["query"],
    },
  },

  // ── lastfm-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "lastfm_artist_info",
    description: "Get Last.fm artist info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        api_key: { type: "string" },
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
        artist: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_top_tracks",
    description: "Get top tracks for an artist on Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_similar_artists",
    description: "Get similar artists on Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["artist"],
    },
  },
  {
    name: "lastfm_chart_top_artists",
    description: "Get the Last.fm chart of top artists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "lastfm_chart_top_tracks",
    description: "Get the Last.fm chart of top tracks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "lastfm_album_info",
    description: "Get album info from Last.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        album: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["artist", "album"],
    },
  },

  // ── discogs-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "discogs_search_releases",
    description: "Search for music releases on Discogs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        artist: { type: "string" },
        type: { type: "string" },
        format: { type: "string" },
        genre: { type: "string" },
        year: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "discogs_get_release",
    description: "Get a Discogs release by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        release_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["release_id"],
    },
  },
  {
    name: "discogs_get_artist",
    description: "Get a Discogs artist by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["artist_id"],
    },
  },
  {
    name: "discogs_search_artists",
    description: "Search for artists on Discogs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "discogs_marketplace_stats",
    description: "Get Discogs marketplace stats for a release.",
    inputSchema: {
      type: "object" as const,
      properties: {
        release_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["release_id"],
    },
  },
  {
    name: "discogs_get_label",
    description: "Get a Discogs record label by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        label_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["label_id"],
    },
  },

  // ── setlistfm-tool.ts ────────────────────────────────────────────────────────
  {
    name: "setlistfm_search_artist",
    description: "Search for an artist on Setlist.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artistName: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["artistName"],
    },
  },
  {
    name: "setlistfm_artist_setlists",
    description: "Get setlists for an artist on Setlist.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        mbid: { type: "string" },
        page: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["mbid"],
    },
  },
  {
    name: "setlistfm_search_setlists",
    description: "Search setlists on Setlist.fm.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artistName: { type: "string" },
        cityName: { type: "string" },
        year: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "setlistfm_get_setlist",
    description: "Get a specific setlist from Setlist.fm by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        setlistId: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["setlistId"],
    },
  },

  // ── bandsintown-tool.ts ──────────────────────────────────────────────────────
  {
    name: "bandsintown_artist",
    description: "Get an artist profile from Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        app_id: { type: "string" },
      },
      required: ["artist"],
    },
  },
  {
    name: "bandsintown_events",
    description: "Get upcoming events for an artist on Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        date: { type: "string" },
        app_id: { type: "string" },
      },
      required: ["artist"],
    },
  },
  {
    name: "bandsintown_recommended",
    description: "Get recommended events for an artist on Bandsintown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artist: { type: "string" },
        location: { type: "string" },
        app_id: { type: "string" },
      },
      required: ["artist"],
    },
  },

  // ── podcastindex-tool.ts ─────────────────────────────────────────────────────
  {
    name: "podcast_search",
    description: "Search for podcasts on Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        max: { type: "number" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "podcast_by_feed_url",
    description: "Get a podcast by feed URL from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "podcast_get_episodes",
    description: "Get episodes for a podcast from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        max: { type: "number" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "podcast_search_episodes",
    description: "Search podcast episodes on Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        max: { type: "number" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
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
        max: { type: "number" },
        lang: { type: "string" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
      },
    },
  },
  {
    name: "podcast_recent_episodes",
    description: "Get recent podcast episodes from Podcast Index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max: { type: "number" },
        api_key: { type: "string" },
        api_secret: { type: "string" },
      },
    },
  },

  // ── lichess-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "lichess_user",
    description: "Get a Lichess user profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_user_games",
    description: "Get games for a Lichess user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
        max: { type: "number" },
        perfType: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["username"],
    },
  },
  {
    name: "lichess_puzzle_daily",
    description: "Get the Lichess daily puzzle.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "lichess_top_players",
    description: "Get top Lichess players for a game mode.",
    inputSchema: {
      type: "object" as const,
      properties: {
        perfType: { type: "string", description: "bullet, blitz, rapid, classical, etc." },
        nb: { type: "number" },
      },
    },
  },
  {
    name: "lichess_tournament",
    description: "Get details for a Lichess tournament.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tournament_id: { type: "string" },
      },
      required: ["tournament_id"],
    },
  },

  // ── chessdotcom-tool.ts ──────────────────────────────────────────────────────
  {
    name: "chess_player",
    description: "Get a Chess.com player profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_stats",
    description: "Get Chess.com player statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
      },
      required: ["username"],
    },
  },
  {
    name: "chess_player_games",
    description: "Get recent games for a Chess.com player.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
        year: { type: "number" },
        month: { type: "number" },
      },
      required: ["username"],
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
    description: "Get Chess.com leaderboards.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },

  // ── fpl-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "fpl_bootstrap",
    description: "Get Fantasy Premier League bootstrap data (players, teams, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "fpl_player",
    description: "Get FPL player details and history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        player_id: { type: "number" },
      },
      required: ["player_id"],
    },
  },
  {
    name: "fpl_gameweek",
    description: "Get FPL gameweek details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gameweek: { type: "number" },
      },
      required: ["gameweek"],
    },
  },
  {
    name: "fpl_fixtures",
    description: "Get FPL fixtures, optionally for a gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gameweek: { type: "number" },
      },
    },
  },
  {
    name: "fpl_my_team",
    description: "Get an FPL manager's team for a gameweek.",
    inputSchema: {
      type: "object" as const,
      properties: {
        manager_id: { type: "number" },
        gameweek: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["manager_id", "gameweek"],
    },
  },
  {
    name: "fpl_manager",
    description: "Get an FPL manager profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        manager_id: { type: "number" },
      },
      required: ["manager_id"],
    },
  },
  {
    name: "fpl_leagues_classic",
    description: "Get FPL classic league standings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        league_id: { type: "number" },
        page: { type: "number" },
      },
      required: ["league_id"],
    },
  },

  // ── guardian-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "guardian_search_articles",
    description: "Search for articles on The Guardian.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        section: { type: "string" },
        from_date: { type: "string" },
        to_date: { type: "string" },
        page_size: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "guardian_get_article",
    description: "Get a specific Guardian article by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        article_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["article_id"],
    },
  },
  {
    name: "guardian_get_sections",
    description: "Get all Guardian sections.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "guardian_get_tags",
    description: "Get Guardian tags.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "guardian_get_edition",
    description: "Get a Guardian edition by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        edition_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["edition_id"],
    },
  },

  // ── newsapi-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "news_top_headlines",
    description: "Get top headlines from NewsAPI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        country: { type: "string" },
        category: { type: "string" },
        q: { type: "string" },
        pageSize: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "news_search",
    description: "Search news articles via NewsAPI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        language: { type: "string" },
        sortBy: { type: "string" },
        pageSize: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["q"],
    },
  },
  {
    name: "news_get_sources",
    description: "Get available news sources from NewsAPI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        country: { type: "string" },
        category: { type: "string" },
        language: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },

  // ── alphavantage-tool.ts ─────────────────────────────────────────────────────
  {
    name: "stock_quote",
    description: "Get a real-time stock quote from Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "stock_search",
    description: "Search for stock tickers on Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keywords: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "stock_daily",
    description: "Get daily stock price history from Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        outputsize: { type: "string", description: "compact or full" },
        api_key: { type: "string" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "stock_intraday",
    description: "Get intraday stock prices from Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        interval: { type: "string", description: "1min, 5min, 15min, 30min, 60min" },
        api_key: { type: "string" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "forex_rate",
    description: "Get a forex exchange rate from Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_currency: { type: "string" },
        to_currency: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["from_currency", "to_currency"],
    },
  },
  {
    name: "crypto_daily",
    description: "Get daily crypto price history from Alpha Vantage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        market: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["symbol"],
    },
  },

  // ── coingecko-tool.ts ────────────────────────────────────────────────────────
  {
    name: "crypto_price",
    description: "Get cryptocurrency prices from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: { type: "string", description: "Comma-separated coin IDs" },
        vs_currencies: { type: "string", description: "Comma-separated currency codes" },
      },
      required: ["ids"],
    },
  },
  {
    name: "crypto_coin",
    description: "Get detailed info for a cryptocurrency from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "crypto_search",
    description: "Search for cryptocurrencies on CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
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
        vs_currency: { type: "string" },
        per_page: { type: "number" },
        page: { type: "number" },
      },
    },
  },
  {
    name: "crypto_coin_history",
    description: "Get historical price data for a cryptocurrency from CoinGecko.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        date: { type: "string", description: "DD-MM-YYYY" },
      },
      required: ["id", "date"],
    },
  },

  // ── coinmarketcap-tool.ts ────────────────────────────────────────────────────
  {
    name: "cmc_listings",
    description: "Get latest cryptocurrency listings from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
        convert: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "cmc_quotes",
    description: "Get cryptocurrency quotes from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        id: { type: "string" },
        convert: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "cmc_info",
    description: "Get cryptocurrency metadata from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string" },
        id: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "cmc_trending",
    description: "Get trending cryptocurrencies from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "cmc_global_metrics",
    description: "Get global cryptocurrency market metrics from CoinMarketCap.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
    },
  },

  // ── openexchangerates-tool.ts ────────────────────────────────────────────────
  {
    name: "forex_latest",
    description: "Get latest forex exchange rates from Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        base: { type: "string" },
        symbols: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "forex_historical",
    description: "Get historical forex rates from Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: { type: "string" },
        base: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["date"],
    },
  },
  {
    name: "forex_currencies",
    description: "List all currencies from Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "forex_convert",
    description: "Convert a currency amount using Open Exchange Rates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["from", "to", "amount"],
    },
  },

  // ── wise-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "wise_exchange_rates",
    description: "Get exchange rates from Wise.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string" },
        target: { type: "string" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "wise_profile",
    description: "Get the authenticated Wise user profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "wise_accounts",
    description: "Get Wise accounts for a profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        profile_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["profile_id"],
    },
  },
  {
    name: "wise_create_quote",
    description: "Create a Wise money transfer quote.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sourceCurrency: { type: "string" },
        targetCurrency: { type: "string" },
        sourceAmount: { type: "number" },
        targetAmount: { type: "number" },
        profile_id: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["sourceCurrency", "targetCurrency"],
    },
  },

  // ── ipapi-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "ip_lookup",
    description: "Look up geolocation for an IP address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ip: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["ip"],
    },
  },
  {
    name: "ip_batch",
    description: "Batch IP address geolocation lookup.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ips: { type: "array", description: "Array of IP address strings" },
        api_key: { type: "string" },
      },
      required: ["ips"],
    },
  },

  // ── restcountries-tool.ts ────────────────────────────────────────────────────
  {
    name: "country_all",
    description: "Get all countries from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fields: { type: "string" },
      },
    },
  },
  {
    name: "country_by_name",
    description: "Get a country by name from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        fullText: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "country_by_code",
    description: "Get a country by code from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string" },
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
        region: { type: "string" },
      },
      required: ["region"],
    },
  },
  {
    name: "country_by_currency",
    description: "Get countries by currency from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        currency: { type: "string" },
      },
      required: ["currency"],
    },
  },
  {
    name: "country_by_language",
    description: "Get countries by language from REST Countries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        language: { type: "string" },
      },
      required: ["language"],
    },
  },

  // ── tomorrowio-tool.ts ───────────────────────────────────────────────────────
  {
    name: "tomorrow_realtime",
    description: "Get realtime weather from Tomorrow.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string", description: "lat,lon or place name" },
        units: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["location"],
    },
  },
  {
    name: "tomorrow_forecast",
    description: "Get a weather forecast from Tomorrow.io.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string" },
        timesteps: { type: "string", description: "1h or 1d" },
        units: { type: "string" },
        api_key: { type: "string" },
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
        location: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["location", "startTime", "endTime"],
    },
  },

  // ── twitch-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "twitch_search_streams",
    description: "Search for live streams on Twitch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_id: { type: "string" },
        user_login: { type: "string" },
        first: { type: "number" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },
  {
    name: "twitch_get_stream",
    description: "Get a specific Twitch stream by user login.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_login: { type: "string" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
      required: ["user_login"],
    },
  },
  {
    name: "twitch_search_games",
    description: "Search for games on Twitch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "twitch_top_games",
    description: "Get top games currently streaming on Twitch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        first: { type: "number" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },
  {
    name: "twitch_get_clips",
    description: "Get clips for a Twitch broadcaster.",
    inputSchema: {
      type: "object" as const,
      properties: {
        broadcaster_id: { type: "string" },
        game_id: { type: "string" },
        first: { type: "number" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },
  {
    name: "twitch_channel_info",
    description: "Get information about a Twitch channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        broadcaster_id: { type: "string" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
      required: ["broadcaster_id"],
    },
  },
  {
    name: "twitch_schedule",
    description: "Get a Twitch channel's streaming schedule.",
    inputSchema: {
      type: "object" as const,
      properties: {
        broadcaster_id: { type: "string" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
      required: ["broadcaster_id"],
    },
  },

  // ── reddit-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "reddit_read",
    description: "Read posts from a Reddit subreddit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        subreddit: { type: "string" },
        sort: { type: "string", description: "hot, new, top, rising" },
        limit: { type: "number" },
        after: { type: "string" },
        t: { type: "string", description: "hour, day, week, month, year, all" },
      },
      required: ["access_token", "subreddit"],
    },
  },
  {
    name: "reddit_post",
    description: "Create a Reddit post.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        subreddit: { type: "string" },
        title: { type: "string" },
        kind: { type: "string", description: "self, link" },
        text: { type: "string" },
        url: { type: "string" },
        nsfw: { type: "boolean" },
        spoiler: { type: "boolean" },
      },
      required: ["access_token", "subreddit", "title", "kind"],
    },
  },
  {
    name: "reddit_comment",
    description: "Post a comment on Reddit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        parent_id: { type: "string" },
        text: { type: "string" },
      },
      required: ["access_token", "parent_id", "text"],
    },
  },
  {
    name: "reddit_search",
    description: "Search Reddit posts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        q: { type: "string" },
        subreddit: { type: "string" },
        sort: { type: "string" },
        limit: { type: "number" },
      },
      required: ["access_token", "q"],
    },
  },
  {
    name: "reddit_user",
    description: "Get a Reddit user profile and posts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        username: { type: "string" },
        type: { type: "string", description: "overview, submitted, comments" },
        limit: { type: "number" },
      },
      required: ["access_token", "username"],
    },
  },
  {
    name: "reddit_vote",
    description: "Vote on a Reddit post or comment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        id: { type: "string" },
        dir: { type: "number", description: "1=upvote, 0=neutral, -1=downvote" },
      },
      required: ["access_token", "id", "dir"],
    },
  },
  {
    name: "reddit_subscribe",
    description: "Subscribe to or unsubscribe from a Reddit subreddit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        sr: { type: "string" },
        action: { type: "string", description: "sub or unsub" },
      },
      required: ["access_token", "sr", "action"],
    },
  },

  // ── mastodon-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "mastodon_action",
    description: "Perform a Mastodon action: mastodon_post, mastodon_read_timeline, mastodon_reply, mastodon_boost, mastodon_favorite, mastodon_search, mastodon_profile, mastodon_follow, mastodon_notifications.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        instance_url: { type: "string" },
        access_token: { type: "string" },
        status: { type: "string" },
        in_reply_to_id: { type: "string" },
        id: { type: "string" },
        q: { type: "string" },
        acct: { type: "string" },
      },
      required: ["action"],
    },
  },

  // ── bluesky-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "bluesky_action",
    description: "Perform a Bluesky action: bluesky_post, bluesky_read_feed, bluesky_reply, bluesky_like, bluesky_repost, bluesky_search, bluesky_profile, bluesky_follow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        identifier: { type: "string", description: "Bluesky handle or DID" },
        password: { type: "string", description: "App password" },
        text: { type: "string" },
        uri: { type: "string" },
        cid: { type: "string" },
        query: { type: "string" },
        actor: { type: "string" },
        limit: { type: "number" },
      },
      required: ["action"],
    },
  },

  // ── discord-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "discord_send",
    description: "Send a message to a Discord channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        channel_id: { type: "string" },
        content: { type: "string" },
        embeds: { type: "array" },
      },
      required: ["bot_token", "channel_id", "content"],
    },
  },
  {
    name: "discord_read",
    description: "Read messages from a Discord channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        channel_id: { type: "string" },
        limit: { type: "number" },
        before: { type: "string" },
      },
      required: ["bot_token", "channel_id"],
    },
  },
  {
    name: "discord_thread",
    description: "Create a Discord thread.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        channel_id: { type: "string" },
        name: { type: "string" },
        message: { type: "string" },
        message_id: { type: "string" },
      },
      required: ["bot_token", "channel_id", "name"],
    },
  },
  {
    name: "discord_react",
    description: "Add a reaction to a Discord message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        channel_id: { type: "string" },
        message_id: { type: "string" },
        emoji: { type: "string" },
      },
      required: ["bot_token", "channel_id", "message_id", "emoji"],
    },
  },
  {
    name: "discord_channels",
    description: "List channels in a Discord guild.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        guild_id: { type: "string" },
      },
      required: ["bot_token", "guild_id"],
    },
  },
  {
    name: "discord_members",
    description: "List members of a Discord guild.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        guild_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["bot_token", "guild_id"],
    },
  },
  {
    name: "discord_search",
    description: "Search messages in a Discord guild.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        guild_id: { type: "string" },
        content: { type: "string" },
        author_id: { type: "string" },
        channel_id: { type: "string" },
      },
      required: ["bot_token", "guild_id"],
    },
  },

  // ── slack-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "slack_action",
    description: "Perform a Slack action: slack_send, slack_read, slack_search, slack_thread_reply, slack_channels, slack_react, slack_upload.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        bot_token: { type: "string" },
        channel: { type: "string" },
        text: { type: "string" },
        thread_ts: { type: "string" },
        query: { type: "string" },
        emoji: { type: "string" },
        timestamp: { type: "string" },
        limit: { type: "number" },
      },
      required: ["action", "bot_token"],
    },
  },

  // ── telegram-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "telegram_send",
    description: "Send a Telegram message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        chat_id: { type: "string" },
        text: { type: "string" },
        parse_mode: { type: "string" },
        reply_to_message_id: { type: "number" },
      },
      required: ["bot_token", "chat_id", "text"],
    },
  },
  {
    name: "telegram_read",
    description: "Read Telegram messages/updates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        offset: { type: "number" },
        limit: { type: "number" },
      },
      required: ["bot_token"],
    },
  },
  {
    name: "telegram_search",
    description: "Search Telegram messages in a chat.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        chat_id: { type: "string" },
        query: { type: "string" },
      },
      required: ["bot_token", "chat_id", "query"],
    },
  },
  {
    name: "telegram_send_media",
    description: "Send media (photo/document/video) via Telegram.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        chat_id: { type: "string" },
        media_type: { type: "string", description: "photo, document, video, audio" },
        media_url: { type: "string" },
        caption: { type: "string" },
      },
      required: ["bot_token", "chat_id", "media_type", "media_url"],
    },
  },
  {
    name: "telegram_get_updates",
    description: "Get Telegram bot updates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        offset: { type: "number" },
        limit: { type: "number" },
        timeout: { type: "number" },
      },
      required: ["bot_token"],
    },
  },
  {
    name: "telegram_manage_chat",
    description: "Manage a Telegram chat (get info, ban, kick, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_token: { type: "string" },
        chat_id: { type: "string" },
        action: { type: "string" },
        user_id: { type: "number" },
      },
      required: ["bot_token", "chat_id", "action"],
    },
  },

  // ── amazon-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "amazon_search",
    description: "Search for products on Amazon.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keywords: { type: "string" },
        searchIndex: { type: "string" },
        itemCount: { type: "number" },
        access_key: { type: "string" },
        secret_key: { type: "string" },
        partner_tag: { type: "string" },
        region: { type: "string" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "amazon_product",
    description: "Get Amazon product details by ASIN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        asin: { type: "string" },
        access_key: { type: "string" },
        secret_key: { type: "string" },
        partner_tag: { type: "string" },
        region: { type: "string" },
      },
      required: ["asin"],
    },
  },
  {
    name: "amazon_browse",
    description: "Browse Amazon product categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        browseNodeId: { type: "string" },
        access_key: { type: "string" },
        secret_key: { type: "string" },
        partner_tag: { type: "string" },
      },
      required: ["browseNodeId"],
    },
  },
  {
    name: "amazon_variations",
    description: "Get Amazon product variations for an ASIN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        asin: { type: "string" },
        access_key: { type: "string" },
        secret_key: { type: "string" },
        partner_tag: { type: "string" },
      },
      required: ["asin"],
    },
  },

  // ── shopify-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "shopify_products",
    description: "Get products from a Shopify store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        limit: { type: "number" },
        collection_id: { type: "number" },
        product_type: { type: "string" },
        vendor: { type: "string" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_orders",
    description: "Get orders from a Shopify store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        limit: { type: "number" },
        status: { type: "string" },
        financial_status: { type: "string" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_customers",
    description: "Get customers from a Shopify store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        limit: { type: "number" },
        email: { type: "string" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_inventory",
    description: "Get inventory for Shopify products.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        product_id: { type: "number" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_collections",
    description: "Get collections from a Shopify store.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_shop",
    description: "Get Shopify store information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain"],
    },
  },
  {
    name: "shopify_fulfillments",
    description: "Get fulfillments for a Shopify order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        shop_domain: { type: "string" },
        order_id: { type: "number" },
        api_key: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["shop_domain", "order_id"],
    },
  },

  // ── yelp-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "yelp_search_businesses",
    description: "Search for businesses on Yelp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        term: { type: "string" },
        location: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        categories: { type: "string" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "yelp_get_business",
    description: "Get details for a Yelp business by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        business_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["business_id"],
    },
  },
  {
    name: "yelp_get_reviews",
    description: "Get reviews for a Yelp business.",
    inputSchema: {
      type: "object" as const,
      properties: {
        business_id: { type: "string" },
        api_key: { type: "string" },
      },
      required: ["business_id"],
    },
  },
  {
    name: "yelp_search_events",
    description: "Search for events on Yelp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        location: { type: "string" },
        categories: { type: "string" },
        start_date: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "yelp_autocomplete",
    description: "Autocomplete a Yelp business search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["text"],
    },
  },

  // ── xero-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "xero_invoices",
    description: "Get invoices from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "DRAFT, SUBMITTED, AUTHORISED, etc." },
        contact_id: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_contacts",
    description: "Get contacts from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" },
        is_supplier: { type: "boolean" },
        is_customer: { type: "boolean" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_accounts",
    description: "Get chart of accounts from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_payments",
    description: "Get payments from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_bank_transactions",
    description: "Get bank transactions from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bank_account_id: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_reports",
    description: "Get financial reports from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        report_type: { type: "string", description: "BalanceSheet, ProfitAndLoss, TrialBalance" },
        from_date: { type: "string" },
        to_date: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
      required: ["report_type"],
    },
  },
  {
    name: "xero_quotes",
    description: "Get quotes from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string" },
        contact_id: { type: "string" },
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },
  {
    name: "xero_organisation",
    description: "Get organisation details from Xero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        tenant_id: { type: "string" },
      },
    },
  },

  // ── csuite-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "csuite_analyze",
    description: "Run a C-Suite multi-perspective analysis on a business scenario.",
    inputSchema: {
      type: "object" as const,
      properties: {
        scenario: { type: "string" },
        context: { type: "string" },
        perspectives: { type: "array", description: "e.g. [\"CEO\",\"CFO\",\"CTO\"]" },
        depth: { type: "string", description: "quick, standard, or deep" },
        focus: { type: "string" },
      },
      required: ["scenario"],
    },
  },

  // ── vault-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "vault_action",
    description: "Perform a vault action: vault_init, vault_store, vault_retrieve, vault_list, vault_delete, vault_rotate, vault_audit.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string" },
        master_password: { type: "string" },
        key: { type: "string" },
        value: { type: "string" },
        encrypt: { type: "boolean" },
      },
      required: ["action", "master_password"],
    },
  },

] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL_HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

export const ADDITIONAL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  // rawg-tool.ts
  rawg_search_games:    (args) => rawgSearchGames(args),
  rawg_get_game:        (args) => rawgGetGame(args),
  rawg_game_screenshots:(args) => rawgGetGameScreenshots(args),
  rawg_list_genres:     (args) => rawgListGenres(args),
  rawg_list_platforms:  (args) => rawgListPlatforms(args),
  rawg_upcoming_games:  (args) => rawgUpcomingGames(args),

  // riot-tool.ts
  riot_summoner:        (args) => riotSummoner(args),
  riot_ranked:          (args) => riotRanked(args),
  riot_match_history:   (args) => riotMatchHistory(args),
  riot_get_match:       (args) => riotGetMatch(args),
  riot_valorant_account:(args) => riotValorantAccount(args),

  // bungie-tool.ts
  bungie_search_player: (args) => bungieSearchPlayer(args),
  bungie_get_profile:   (args) => bungieGetProfile(args),
  bungie_get_manifest:  (args) => bungieGetManifest(args),
  bungie_search_entities:(args) => bungieSearchEntities(args),

  // supercell-tool.ts
  coc_player:           (args) => cocPlayer(args),
  coc_clan:             (args) => cocClan(args),
  coc_clan_members:     (args) => cocClanMembers(args),
  cr_player:            (args) => crPlayer(args),
  cr_top_players:       (args) => crTopPlayers(args),
  bs_player:            (args) => bsPlayer(args),
  bs_club:              (args) => bsClub(args),

  // lego-tool.ts
  lego_search_sets:     (args) => legoSearchSets(args),
  lego_get_set:         (args) => legoGetSet(args),
  lego_set_parts:       (args) => legoSetParts(args),
  lego_search_parts:    (args) => legoSearchParts(args),
  lego_themes:          (args) => legoThemes(args),
  brickset_search:      (args) => bricksetSearch(args),
  brickset_get_set:     (args) => bricksetGetSet(args),

  // untappd-tool.ts
  untappd_search_beer:  (args) => untappdSearchBeer(args),
  untappd_get_beer:     (args) => untappdGetBeer(args),
  untappd_get_brewery:  (args) => untappdGetBrewery(args),
  untappd_search_brewery:(args) => untappdSearchBrewery(args),
  untappd_beer_activities:(args) => untappdBeerActivities(args),

  // pandascore-tool.ts
  esports_matches:      (args) => esportsMatches(args),
  esports_tournaments:  (args) => esportsTournaments(args),
  esports_teams:        (args) => esportsTeams(args),
  esports_players:      (args) => esportsPlayers(args),
  esports_get_match:    (args) => esportsGetMatch(args),

  // amber-tool.ts
  amber_sites:          (args) => getAmberSites(args),
  amber_current_price:  (args) => getAmberCurrentPrice(args),
  amber_forecast:       (args) => getAmberForecast(args),

  // willyweather-tool.ts
  willyweather_forecast:(args) => getWillyweatherForecast(args),
  willyweather_surf:    (args) => getWillyweatherSurf(args),
  willyweather_tide:    (args) => getWillyweatherTide(args),

  // domain-tool.ts
  domain_search_listings:(args) => searchDomainListings(args),
  domain_get_property:  (args) => getDomainProperty(args),
  domain_suburb_stats:  (args) => getDomainSuburbStats(args),

  // trove-tool.ts
  trove_search:         (args) => searchTrove(args),
  trove_get_work:       (args) => getTroveWork(args),
  trove_newspaper_article:(args) => getTroveNewspaperArticle(args),

  // australiapost-tool.ts
  auspost_track_parcel: (args) => trackAuspostParcel(args),
  auspost_get_postcode: (args) => getAuspostPostcode(args),
  auspost_delivery_times:(args) => getAuspostDeliveryTimes(args),

  // sendle-tool.ts
  sendle_get_quote:     (args) => getSendleQuote(args),
  sendle_create_order:  (args) => createSendleOrder(args),
  sendle_track_parcel:  (args) => trackSendleParcel(args),

  // ipaustralia-tool.ts
  search_trademarks:    (args) => searchTrademarks(args),
  get_trademark_details:(args) => getTrademarkDetails(args),
  search_patents:       (args) => searchPatents(args),

  // tab-tool.ts
  tab_meetings:         (args) => getTabMeetings(args),
  tab_race:             (args) => getTabRace(args),
  tab_sports_markets:   (args) => getTabSportsMarkets(args),

  // thelott-tool.ts
  lott_results:         (args) => getLottResults(args),
  lott_jackpots:        (args) => getLottJackpots(args),

  // abn-tool.ts
  abn_lookup:           (args) => abnLookup(args),
  abn_search:           (args) => abnSearch(args),

  // ptv-tool.ts
  ptv_search:           (args) => ptvSearch(args),
  ptv_departures:       (args) => ptvDepartures(args),
  ptv_disruptions:      (args) => ptvDisruptions(args),
  ptv_stops_on_route:   (args) => ptvStopsOnRoute(args),
  ptv_route_directions: (args) => ptvRouteDirections(args),

  // nvd-tool.ts
  get_cve_detail:       (args) => getCveDetail(args),
  search_cve:           (args) => searchCve(args),
  get_recent_cves:      (args) => getRecentCves(args),

  // hunter-tool.ts
  hunter_find_email:    (args) => findEmail(args),
  hunter_verify_email:  (args) => verifyEmail(args),
  hunter_domain_info:   (args) => getDomainInfo(args),

  // haveibeenpwned-tool.ts
  hibp_check_account:   (args) => checkAccountBreaches(args),
  hibp_all_breaches:    (args) => getAllBreaches(args),
  hibp_check_password:  (args) => checkPassword(args),

  // virustotal-tool.ts
  virustotal_scan_url:  (args) => scanUrlVirustotal(args),
  virustotal_url_report:(args) => getUrlReport(args),
  virustotal_scan_ip:   (args) => scanIpVirustotal(args),
  virustotal_scan_domain:(args) => scanDomainVirustotal(args),

  // abuseipdb-tool.ts
  abuseipdb_check_ip:   (args) => checkIpAbuse(args),
  abuseipdb_report_ip:  (args) => reportIpAbuse(args),
  abuseipdb_blacklist:  (args) => getBlacklistAbuseipdb(args),

  // urlscan-tool.ts
  urlscan_scan:         (args) => scanUrlUrlscan(args),
  urlscan_get_result:   (args) => getScanResult(args),
  urlscan_search:       (args) => searchUrlscan(args),

  // shodan-tool.ts
  shodan_search:        (args) => searchShodan(args),
  shodan_host_info:     (args) => getHostInfo(args),
  shodan_stats:         (args) => getShodanStats(args),

  // resend-tool.ts
  resend_send_email:    (args) => sendEmailResend(args),
  resend_get_email:     (args) => getEmailResend(args),
  resend_list_domains:  (args) => listDomainsResend(args),

  // vercel-tool.ts
  vercel_list_deployments:(args) => listVercelDeployments(args),
  vercel_get_deployment:(args) => getVercelDeployment(args),
  vercel_list_projects: (args) => listVercelProjects(args),
  vercel_get_domain:    (args) => getVercelDomain(args),
  vercel_get_env:       (args) => getVercelEnv(args),

  // toggl-tool.ts
  toggl_time_entries:   (args) => getTogglTimeEntries(args),
  toggl_create_time_entry:(args) => createTimeEntryToggl(args),
  toggl_projects:       (args) => getTogglProjects(args),
  toggl_summary:        (args) => getTogglSummary(args),

  // email-tool.ts
  email_send:           (args) => sendEmail(args),
  email_read_inbox:     (args) => readInbox(args),
  email_search:         (args) => searchEmail(args),
  email_get:            (args) => getEmail(args),
  email_mark_read:      (args) => markRead(args),
  email_delete:         (args) => deleteEmail(args),

  // usgs-tool.ts
  usgs_recent_earthquakes:   (args) => getRecentEarthquakes(args),
  usgs_earthquake_detail:    (args) => getEarthquakeDetail(args),
  usgs_earthquakes_by_region:(args) => getEarthquakesByRegion(args),

  // openaq-tool.ts
  openaq_air_quality:   (args) => getAirQuality(args),
  openaq_measurements:  (args) => getAirMeasurements(args),
  openaq_countries:     (args) => getAqCountries(args),

  // openfoodfacts-tool.ts
  food_search:          (args) => searchFoodProducts(args),
  food_get_product:     (args) => getFoodProduct(args),
  food_by_category:     (args) => getFoodByCategory(args),

  // ebird-tool.ts
  ebird_recent_observations:  (args) => getRecentObservations(args),
  ebird_notable_observations: (args) => getNotableObservations(args),
  ebird_species_info:         (args) => getSpeciesInfo(args),

  // carboninterface-tool.ts
  carbon_flight_emissions:     (args) => estimateFlightEmissions(args),
  carbon_vehicle_emissions:    (args) => estimateVehicleEmissions(args),
  carbon_electricity_emissions:(args) => estimateElectricityEmissions(args),

  // toilets-tool.ts
  find_nearest_toilets: (args) => findNearestToilets(args),
  get_toilet_details:   (args) => getToiletDetails(args),

  // calculator-tool.ts
  calc_tip:             (args) => Promise.resolve(calculateTip(args)),
  calc_mortgage:        (args) => Promise.resolve(calculateMortgage(args)),
  calc_bmi:             (args) => Promise.resolve(calculateBmi(args)),
  calc_compound_interest:(args) => Promise.resolve(calculateCompoundInterest(args)),
  calc_currency_estimate:(args) => Promise.resolve(convertCurrencyEstimate(args)),

  // unit-converter-tool.ts
  convert_length:       (args) => Promise.resolve(convertLength(args)),
  convert_weight:       (args) => Promise.resolve(convertWeight(args)),
  convert_temperature:  (args) => Promise.resolve(convertTemperature(args)),
  convert_volume:       (args) => Promise.resolve(convertVolume(args)),
  convert_speed:        (args) => Promise.resolve(convertSpeed(args)),
  convert_area:         (args) => Promise.resolve(convertArea(args)),
  convert_data_storage: (args) => Promise.resolve(convertDataStorage(args)),

  // datetime-tool.ts
  datetime_current_time:   (args) => Promise.resolve(getCurrentTime(args)),
  datetime_convert_timezone:(args) => Promise.resolve(convertTimezone(args)),
  datetime_date_diff:      (args) => Promise.resolve(calculateDateDiff(args)),
  datetime_add_to_date:    (args) => Promise.resolve(addToDate(args)),
  datetime_business_days:  (args) => Promise.resolve(getBusinessDays(args)),
  datetime_format_date:    (args) => Promise.resolve(formatDate(args)),
  datetime_week_number:    (args) => Promise.resolve(getWeekNumber(args)),

  // text-tool.ts
  text_analyse:            (args) => Promise.resolve(analyseText(args)),
  text_transform:          (args) => Promise.resolve(transformText(args)),
  text_extract_emails:     (args) => Promise.resolve(extractEmails(args)),
  text_extract_urls:       (args) => Promise.resolve(extractUrls(args)),
  text_extract_phone_numbers:(args) => Promise.resolve(extractPhoneNumbers(args)),
  text_count_occurrences:  (args) => Promise.resolve(countOccurrences(args)),
  text_truncate:           (args) => Promise.resolve(truncateText(args)),

  // meal-tool.ts
  meal_search:             (args) => searchMeals(args),
  meal_random:             (args) => getRandomMeal(args),
  meal_get_by_id:          (args) => getMealById(args),
  meal_categories:         (args) => listMealCategories(args),
  meal_filter_by_category: (args) => filterMealsByCategory(args),
  meal_filter_by_area:     (args) => filterMealsByArea(args),
  meal_filter_by_ingredient:(args) => filterMealsByIngredient(args),

  // espn-tool.ts
  espn_nfl_scores:         (args) => getNflScores(args),
  espn_nba_scores:         (args) => getNbaScores(args),
  espn_mlb_scores:         (args) => getMlbScores(args),
  espn_nhl_scores:         (args) => getNhlScores(args),
  espn_soccer_scores:      (args) => getSoccerScores(args),
  espn_news:               (args) => getEspnNews(args),
  espn_team_info:          (args) => getTeamInfo(args),

  // sleeper-tool.ts
  sleeper_nfl_state:       (args) => getNflState(args),
  sleeper_players:         (args) => getSleeperPlayers(args),
  sleeper_trending_players:(args) => getTrendingPlayers(args),
  sleeper_league:          (args) => getSleeperLeague(args),
  sleeper_league_rosters:  (args) => getLeagueRosters(args),
  sleeper_league_matchups: (args) => getLeagueMatchups(args),

  // deezer-tool.ts
  deezer_search:           (args) => searchDeezer(args),
  deezer_get_artist:       (args) => getDeezerArtist(args),
  deezer_get_album:        (args) => getDeezerAlbum(args),
  deezer_get_track:        (args) => getDeezerTrack(args),
  deezer_chart:            (args) => getDeezerChart(args),
  deezer_search_playlist:  (args) => searchDeezerPlaylist(args),

  // color-tool.ts
  color_convert:           (args) => Promise.resolve(convertColor(args)),
  color_info:              (args) => Promise.resolve(getColorInfo(args)),
  color_palette:           (args) => Promise.resolve(generateColorPalette(args)),
  color_mix:               (args) => Promise.resolve(mixColors(args)),
  color_contrast_ratio:    (args) => Promise.resolve(checkContrastRatio(args)),

  // random-tool.ts
  random_uuid:             (args) => Promise.resolve(generateUuid(args)),
  random_number:           (args) => Promise.resolve(generateRandomNumber(args)),
  random_string:           (args) => Promise.resolve(generateRandomString(args)),
  random_pick_from_list:   (args) => Promise.resolve(pickRandomFromList(args)),
  random_flip_coin:        (args) => Promise.resolve(flipCoin(args)),
  random_roll_dice:        (args) => Promise.resolve(rollDice(args)),
  random_shuffle_list:     (args) => Promise.resolve(shuffleList(args)),
  random_lorem_ipsum:      (args) => Promise.resolve(generateLoremIpsum(args)),

  // notion-tool.ts
  notion_action:           (args) => notionAction(String(args.action ?? ""), args),

  // readwise-tool.ts
  readwise_action:         (args) => readwiseAction(String(args.action ?? ""), args),

  // raindrop-tool.ts
  raindrop_action:         (args) => raindropAction(String(args.action ?? ""), args),

  // clockify-tool.ts
  clockify_action:         (args) => clockifyAction(String(args.action ?? ""), args),

  // splitwise-tool.ts
  splitwise_action:        (args) => splitwiseAction(String(args.action ?? ""), args),

  // instapaper-tool.ts
  instapaper_action:       (args) => instapaperAction(String(args.action ?? ""), args),

  // monica-tool.ts
  monica_action:           (args) => monicaAction(String(args.action ?? ""), args),

  // feedly-tool.ts
  feedly_action:           (args) => feedlyAction(String(args.action ?? ""), args),

  // hackernews-tool.ts
  hn_top_stories:          (args) => hnTopStories(args),
  hn_new_stories:          (args) => hnNewStories(args),
  hn_best_stories:         (args) => hnBestStories(args),
  hn_ask_hn:               (args) => hnAskHn(args),
  hn_show_hn:              (args) => hnShowHn(args),
  hn_item:                 (args) => hnItem(args),
  hn_user:                 (args) => hnUser(args),

  // openf1-tool.ts
  f1_sessions:             (args) => f1Sessions(args),
  f1_drivers:              (args) => f1Drivers(args),
  f1_positions:            (args) => f1Positions(args),
  f1_laps:                 (args) => f1Laps(args),
  f1_pit_stops:            (args) => f1PitStops(args),
  f1_car_data:             (args) => f1CarData(args),
  f1_team_radio:           (args) => f1TeamRadio(args),
  f1_weather:              (args) => f1Weather(args),

  // tmdb-tool.ts
  tmdb_search_movies:      (args) => tmdbSearchMovies(args),
  tmdb_search_tv:          (args) => tmdbSearchTv(args),
  tmdb_movie:              (args) => tmdbMovie(args),
  tmdb_tv:                 (args) => tmdbTv(args),
  tmdb_trending:           (args) => tmdbTrending(args),
  tmdb_now_playing:        (args) => tmdbNowPlaying(args),
  tmdb_upcoming:           (args) => tmdbUpcoming(args),
  tmdb_popular_tv:         (args) => tmdbPopularTv(args),

  // trivia-tool.ts
  trivia_questions:        (args) => triviaQuestions(args),
  trivia_categories:       (args) => triviaCategories(args),

  // nasa-tool.ts
  nasa_apod:               (args) => nasaApod(args),
  nasa_asteroids:          (args) => nasaAsteroids(args),
  nasa_mars_photos:        (args) => nasaMarsPhotos(args),
  nasa_earth_imagery:      (args) => nasaEarthImagery(args),
  nasa_epic:               (args) => nasaEpic(args),

  // openmeteo-tool.ts
  weather_current:         (args) => weatherCurrent(args),
  weather_forecast:        (args) => weatherForecast(args),
  weather_hourly:          (args) => weatherHourly(args),

  // radiobrowser-tool.ts
  radio_search:            (args) => radioSearch(args),
  radio_by_country:        (args) => radioByCountry(args),
  radio_top_clicked:       (args) => radioTopClicked(args),
  radio_top_voted:         (args) => radioTopVoted(args),
  radio_by_tag:            (args) => radioByTag(args),
  radio_countries:         (args) => radioCountries(args),

  // numbers-tool.ts
  number_fact:             (args) => numberFact(args),
  number_random:           (args) => numberRandom(args),

  // omdb-tool.ts
  omdb_search:             (args) => omdbSearch(args),
  omdb_by_title:           (args) => omdbGetByTitle(args),
  omdb_by_id:              (args) => omdbGetById(args),

  // openlibrary-tool.ts
  openlibrary_search:      (args) => openlibrarySearch(args),
  openlibrary_get_book:    (args) => openlibraryGetBook(args),
  openlibrary_get_edition: (args) => openlibraryGetEdition(args),
  openlibrary_get_author:  (args) => openlibraryGetAuthor(args),
  openlibrary_author_works:(args) => openlibraryAuthorWorks(args),
  openlibrary_trending:    (args) => openlibraryTrending(args),

  // musicbrainz-tool.ts
  mb_search_artists:       (args) => mbSearchArtists(args),
  mb_search_releases:      (args) => mbSearchReleases(args),
  mb_search_recordings:    (args) => mbSearchRecordings(args),
  mb_get_artist:           (args) => mbGetArtist(args),
  mb_get_release:          (args) => mbGetRelease(args),

  // genius-tool.ts
  genius_search:           (args) => geniusSearch(args),
  genius_get_song:         (args) => geniusGetSong(args),
  genius_get_artist:       (args) => geniusGetArtist(args),
  genius_artist_songs:     (args) => geniusArtistSongs(args),

  // ticketmaster-tool.ts
  tm_search_events:        (args) => tmSearchEvents(args),
  tm_get_event:            (args) => tmGetEvent(args),
  tm_search_venues:        (args) => tmSearchVenues(args),
  tm_get_venue:            (args) => tmGetVenue(args),
  tm_search_attractions:   (args) => tmSearchAttractions(args),

  // seatgeek-tool.ts
  seatgeek_search_events:  (args) => seatgeekSearchEvents(args),
  seatgeek_get_event:      (args) => seatgeekGetEvent(args),
  seatgeek_search_performers:(args) => seatgeekSearchPerformers(args),
  seatgeek_get_performer:  (args) => seatgeekGetPerformer(args),
  seatgeek_search_venues:  (args) => seatgeekSearchVenues(args),
  seatgeek_get_venue:      (args) => seatgeekGetVenue(args),

  // eventbrite-tool.ts
  eventbrite_search_events:(args) => eventbriteSearchEvents(args),
  eventbrite_get_event:    (args) => eventbriteGetEvent(args),
  eventbrite_get_attendees:(args) => eventbriteGetEventAttendees(args),
  eventbrite_create_event: (args) => eventbriteCreateEvent(args),
  eventbrite_list_categories:(args) => eventbriteListCategories(args),
  eventbrite_get_venue:    (args) => eventbriteGetVenue(args),

  // foursquare-tool.ts
  foursquare_search_places:(args) => foursquareSearchPlaces(args),
  foursquare_get_place:    (args) => foursquareGetPlace(args),
  foursquare_get_photos:   (args) => foursquareGetPhotos(args),
  foursquare_get_tips:     (args) => foursquareGetTips(args),
  foursquare_autocomplete: (args) => foursquareAutocomplete(args),

  // lastfm-tool.ts
  lastfm_artist_info:      (args) => lastfmGetArtistInfo(args),
  lastfm_search_artists:   (args) => lastfmSearchArtists(args),
  lastfm_top_tracks:       (args) => lastfmGetTopTracks(args),
  lastfm_similar_artists:  (args) => lastfmGetSimilarArtists(args),
  lastfm_chart_top_artists:(args) => lastfmGetChartTopArtists(args),
  lastfm_chart_top_tracks: (args) => lastfmGetChartTopTracks(args),
  lastfm_album_info:       (args) => lastfmGetAlbumInfo(args),

  // discogs-tool.ts
  discogs_search_releases: (args) => discogsSearchReleases(args),
  discogs_get_release:     (args) => discogsGetRelease(args),
  discogs_get_artist:      (args) => discogsGetArtist(args),
  discogs_search_artists:  (args) => discogsSearchArtists(args),
  discogs_marketplace_stats:(args) => discogsGetMarketplaceStats(args),
  discogs_get_label:       (args) => discogsGetLabel(args),

  // setlistfm-tool.ts
  setlistfm_search_artist: (args) => setlistfmSearchArtist(args),
  setlistfm_artist_setlists:(args) => setlistfmArtistSetlists(args),
  setlistfm_search_setlists:(args) => setlistfmSearchSetlists(args),
  setlistfm_get_setlist:   (args) => setlistfmGetSetlist(args),

  // bandsintown-tool.ts
  bandsintown_artist:      (args) => bandsintownArtist(args),
  bandsintown_events:      (args) => bandsintownEvents(args),
  bandsintown_recommended: (args) => bandsintownRecommended(args),

  // podcastindex-tool.ts
  podcast_search:          (args) => podcastSearch(args),
  podcast_by_feed_url:     (args) => podcastGetByFeedUrl(args),
  podcast_get_episodes:    (args) => podcastGetEpisodes(args),
  podcast_search_episodes: (args) => podcastSearchEpisodes(args),
  podcast_trending:        (args) => podcastTrending(args),
  podcast_recent_episodes: (args) => podcastRecentEpisodes(args),

  // lichess-tool.ts
  lichess_user:            (args) => lichessUser(args),
  lichess_user_games:      (args) => lichessUserGames(args),
  lichess_puzzle_daily:    (args) => lichessPuzzleDaily(args),
  lichess_top_players:     (args) => lichessTopPlayers(args),
  lichess_tournament:      (args) => lichessTournament(args),

  // chessdotcom-tool.ts
  chess_player:            (args) => chessPlayer(args),
  chess_player_stats:      (args) => chessPlayerStats(args),
  chess_player_games:      (args) => chessPlayerGames(args),
  chess_puzzles_random:    (args) => chessPuzzlesRandom(args),
  chess_leaderboards:      (args) => chessLeaderboards(args),

  // fpl-tool.ts
  fpl_bootstrap:           (args) => fplBootstrap(args),
  fpl_player:              (args) => fplPlayer(args),
  fpl_gameweek:            (args) => fplGameweek(args),
  fpl_fixtures:            (args) => fplFixtures(args),
  fpl_my_team:             (args) => fplMyTeam(args),
  fpl_manager:             (args) => fplManager(args),
  fpl_leagues_classic:     (args) => fplLeaguesClassic(args),

  // guardian-tool.ts
  guardian_search_articles:(args) => guardianSearchArticles(args),
  guardian_get_article:    (args) => guardianGetArticle(args),
  guardian_get_sections:   (args) => guardianGetSections(args),
  guardian_get_tags:       (args) => guardianGetTags(args),
  guardian_get_edition:    (args) => guardianGetEdition(args),

  // newsapi-tool.ts
  news_top_headlines:      (args) => newsGetTopHeadlines(args),
  news_search:             (args) => newsSearchNews(args),
  news_get_sources:        (args) => newsGetSources(args),

  // alphavantage-tool.ts
  stock_quote:             (args) => stockQuote(args),
  stock_search:            (args) => stockSearch(args),
  stock_daily:             (args) => stockDaily(args),
  stock_intraday:          (args) => stockIntraday(args),
  forex_rate:              (args) => forexRate(args),
  crypto_daily:            (args) => cryptoDaily(args),

  // coingecko-tool.ts
  crypto_price:            (args) => cryptoPrice(args),
  crypto_coin:             (args) => cryptoCoin(args),
  crypto_search:           (args) => cryptoSearch(args),
  crypto_trending:         (args) => cryptoTrending(args),
  crypto_top_coins:        (args) => cryptoTopCoins(args),
  crypto_coin_history:     (args) => cryptoCoinHistory(args),

  // coinmarketcap-tool.ts
  cmc_listings:            (args) => cmcListings(args),
  cmc_quotes:              (args) => cmcQuotes(args),
  cmc_info:                (args) => cmcInfo(args),
  cmc_trending:            (args) => cmcTrending(args),
  cmc_global_metrics:      (args) => cmcGlobalMetrics(args),

  // openexchangerates-tool.ts
  forex_latest:            (args) => forexLatest(args),
  forex_historical:        (args) => forexHistorical(args),
  forex_currencies:        (args) => forexCurrencies(args),
  forex_convert:           (args) => forexConvert(args),

  // wise-tool.ts
  wise_exchange_rates:     (args) => wiseExchangeRates(args),
  wise_profile:            (args) => wiseProfile(args),
  wise_accounts:           (args) => wiseAccounts(args),
  wise_create_quote:       (args) => wiseCreateQuote(args),

  // ipapi-tool.ts
  ip_lookup:               (args) => ipLookup(args),
  ip_batch:                (args) => ipBatch(args),

  // restcountries-tool.ts
  country_all:             (args) => countryAll(args),
  country_by_name:         (args) => countryByName(args),
  country_by_code:         (args) => countryByCode(args),
  country_by_region:       (args) => countryByRegion(args),
  country_by_currency:     (args) => countryByCurrency(args),
  country_by_language:     (args) => countryByLanguage(args),

  // tomorrowio-tool.ts
  tomorrow_realtime:       (args) => tomorrowRealtime(args),
  tomorrow_forecast:       (args) => tomorrowForecast(args),
  tomorrow_history:        (args) => tomorrowHistory(args),

  // twitch-tool.ts
  twitch_search_streams:   (args) => twitchSearchStreams(args),
  twitch_get_stream:       (args) => twitchGetStream(args),
  twitch_search_games:     (args) => twitchSearchGames(args),
  twitch_top_games:        (args) => twitchGetTopGames(args),
  twitch_get_clips:        (args) => twitchGetClips(args),
  twitch_channel_info:     (args) => twitchGetChannelInfo(args),
  twitch_schedule:         (args) => twitchGetSchedule(args),

  // reddit-tool.ts
  reddit_read:             (args) => redditRead(args as unknown as Parameters<typeof redditRead>[0]),
  reddit_post:             (args) => redditPost(args as unknown as Parameters<typeof redditPost>[0]),
  reddit_comment:          (args) => redditComment(args as unknown as Parameters<typeof redditComment>[0]),
  reddit_search:           (args) => redditSearch(args as unknown as Parameters<typeof redditSearch>[0]),
  reddit_user:             (args) => redditUser(args as unknown as Parameters<typeof redditUser>[0]),
  reddit_vote:             (args) => redditVote(args as unknown as Parameters<typeof redditVote>[0]),
  reddit_subscribe:        (args) => redditSubscribe(args as unknown as Parameters<typeof redditSubscribe>[0]),

  // mastodon-tool.ts
  mastodon_action:         (args) => mastodonAction(String(args.action ?? ""), args),

  // bluesky-tool.ts
  bluesky_action:          (args) => blueskyAction(String(args.action ?? ""), args),

  // discord-tool.ts
  discord_send:            (args) => discordSend(args),
  discord_read:            (args) => discordRead(args),
  discord_thread:          (args) => discordThread(args),
  discord_react:           (args) => discordReact(args),
  discord_channels:        (args) => discordChannels(args),
  discord_members:         (args) => discordMembers(args),
  discord_search:          (args) => discordSearch(args),

  // slack-tool.ts
  slack_action:            (args) => slackAction(String(args.action ?? ""), args),

  // telegram-tool.ts
  telegram_send:           (args) => telegramSend(args),
  telegram_read:           (args) => telegramRead(args),
  telegram_search:         (args) => telegramSearch(args),
  telegram_send_media:     (args) => telegramSendMedia(args),
  telegram_get_updates:    (args) => telegramGetUpdates(args),
  telegram_manage_chat:    (args) => telegramManageChat(args),

  // amazon-tool.ts
  amazon_search:           (args) => amazonSearch(args),
  amazon_product:          (args) => amazonProduct(args),
  amazon_browse:           (args) => amazonBrowse(args),
  amazon_variations:       (args) => amazonVariations(args),

  // shopify-tool.ts
  shopify_products:        (args) => shopifyProducts(args),
  shopify_orders:          (args) => shopifyOrders(args),
  shopify_customers:       (args) => shopifyCustomers(args),
  shopify_inventory:       (args) => shopifyInventory(args),
  shopify_collections:     (args) => shopifyCollections(args),
  shopify_shop:            (args) => shopifyShop(args),
  shopify_fulfillments:    (args) => shopifyFulfillments(args),

  // yelp-tool.ts
  yelp_search_businesses:  (args) => yelpSearchBusinesses(args),
  yelp_get_business:       (args) => yelpGetBusiness(args),
  yelp_get_reviews:        (args) => yelpGetReviews(args),
  yelp_search_events:      (args) => yelpSearchEvents(args),
  yelp_autocomplete:       (args) => yelpGetAutocomplete(args),

  // xero-tool.ts
  xero_invoices:           (args) => xeroInvoices(args),
  xero_contacts:           (args) => xeroContacts(args),
  xero_accounts:           (args) => xeroAccounts(args),
  xero_payments:           (args) => xeroPayments(args),
  xero_bank_transactions:  (args) => xeroBankTransactions(args),
  xero_reports:            (args) => xeroReports(args),
  xero_quotes:             (args) => xeroQuotes(args),
  xero_organisation:       (args) => xeroOrganisation(args),

  // csuite-tool.ts
  csuite_analyze: (args) => Promise.resolve(csuitAnalyze(
    String(args.scenario ?? ""),
    {
      context:      args.context      ? String(args.context)      : undefined,
      perspectives: Array.isArray(args.perspectives) ? args.perspectives as string[] : undefined,
      depth:        args.depth        ? (args.depth as "quick" | "standard" | "deep") : undefined,
      focus:        args.focus        ? String(args.focus)        : undefined,
    }
  )),

  // vault-tool.ts
  vault_action:            (args) => vaultAction(String(args.action ?? ""), args),
};
