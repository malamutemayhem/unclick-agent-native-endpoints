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

import {
  bggSearch, bggGameDetails, bggUserCollection,
  bggTopGames, bggGameReviews,
} from "./bgg-tool.js";

import {
  gdeltNewsSearch, gdeltToneAnalysis, gdeltGeoEvents, gdeltTrending,
} from "./gdelt-tool.js";

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
  lineSendMessage, lineSendFlexMessage, lineGetProfile,
  lineGetGroupSummary, lineReplyMessage, lineBroadcast,
} from "./line-tool.js";

import {
  figmaGetFile, figmaGetNode, figmaGetImages,
  figmaGetComments, figmaPostComment, figmaGetComponents, figmaGetTeamProjects,
} from "./figma-tool.js";

// ─── Messaging ────────────────────────────────────────────────────────────────
import {
  twilioSendSms, twilioListMessages, twilioGetMessage,
  twilioMakeCall, twilioListCalls, twilioSendVerify, twilioCheckVerify,
} from "./twilio-tool.js";

import {
  pushoverSendNotification, pushoverGetReceipt, pushoverCancelEmergency,
  pushoverListSounds, pushoverValidateUser,
} from "./pushover-tool.js";

import {
  whatsappSendText, whatsappSendTemplate, whatsappSendMedia,
  whatsappGetMedia, whatsappUploadMedia,
} from "./whatsapp-tool.js";

// ─── Media / Data ─────────────────────────────────────────────────────────────
import {
  youtubeSearch, youtubeGetVideo, youtubeGetChannel,
  youtubeListPlaylists, youtubeListPlaylistItems, youtubeGetCaptions,
} from "./youtube-tool.js";

import {
  spotifySearch, spotifyGetTrack, spotifyGetAlbum,
  spotifyGetArtist, spotifyGetPlaylist,
  spotifyGetRecommendations, spotifyGetAudioFeatures,
} from "./spotify-tool.js";

// ─── AI ───────────────────────────────────────────────────────────────────────
import {
  elevenlabsListVoices, elevenlabsGetVoice, elevenlabsTextToSpeech,
  elevenlabsGetModels, elevenlabsGetHistory,
} from "./elevenlabs-tool.js";

import {
  replicateListModels, replicateGetModel, replicateCreatePrediction,
  replicateGetPrediction, replicateListPredictions, replicateCancelPrediction,
} from "./replicate-tool.js";

import {
  stabilityTextToImage, stabilityImageToImage,
  stabilityUpscale, stabilityListEngines,
} from "./stability-tool.js";

import {
  openaiChatCompletion, openaiCreateEmbedding, openaiGenerateImage,
  openaiCreateTranscription, openaiListModels,
} from "./openai-tool.js";

import {
  anthropicCreateMessage, anthropicListModels,
} from "./anthropic-tool.js";

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

import {
  ebaySearch, ebayGetItem, ebayGetItemByLegacyId, ebayGetCategories,
} from "./ebay-tool.js";

import {
  etsySearchListings, etsyGetListing, etsyGetShop,
  etsyGetShopListings, etsySearchShops,
} from "./etsy-tool.js";

import {
  stripeCustomers, stripeCharges, stripeSubscriptions,
  stripeInvoices, stripeProducts, stripePrices,
} from "./stripe-tool.js";

import {
  paypalOrders, paypalInvoices,
} from "./paypal-tool.js";

import {
  squarePayments, squareCustomers, squareCatalogList, squareCatalogSearch,
} from "./square-tool.js";

import {
  quickbooksCustomers, quickbooksInvoices, quickbooksItems, quickbooksPayments,
} from "./quickbooks-tool.js";

import {
  plaidAccounts, plaidTransactions, plaidBalances,
  plaidIdentity, plaidLinkTokenCreate,
} from "./plaid-tool.js";

import {
  wooProducts, wooOrders, wooCustomers,
} from "./woocommerce-tool.js";

import { csuitAnalyze } from "./csuite-tool.js";
import { vaultAction } from "./vault-tool.js";

// ─── Developer / Productivity ─────────────────────────────────────────────────
import { githubAction } from "./github-tool.js";
import { gitlabAction } from "./gitlab-tool.js";
import { clickupAction } from "./clickup-tool.js";
import { linearAction } from "./linear-tool.js";
import { airtableAction } from "./airtable-tool.js";
import { trelloAction } from "./trello-tool.js";
import { sentryAction } from "./sentry-tool.js";
import { postmanAction } from "./postman-tool.js";

// ─── Productivity / Social / Misc ─────────────────────────────────────────────
import {
  listAsanaWorkspaces, listAsanaProjects, listAsanaTasks,
  createAsanaTask, updateAsanaTask, getAsanaTask, searchAsanaTasks,
} from "./asana-tool.js";

import {
  listMondayBoards, getMondayBoard, listMondayItems,
  createMondayItem, updateMondayItem, searchMondayItems,
} from "./monday-tool.js";

import {
  getCalendlyUser, listCalendlyEventTypes, listCalendlyEvents,
  getCalendlyEvent, listCalendlyInvitees,
} from "./calendly-tool.js";

import {
  listPinterestBoards, getPinterestBoard, listPinterestPins,
  createPinterestPin, searchPinterestPins, getPinterestUser,
} from "./pinterest-tool.js";

import {
  getTiktokUser, listTiktokVideos, getTiktokVideo,
} from "./tiktok-tool.js";

import {
  getSteamPlayerSummaries, getSteamOwnedGames, getSteamAchievements,
  getSteamAppDetails, searchSteamStore,
} from "./steam-tool.js";

import {
  igdbSearchGames, igdbGetGame, igdbListPlatforms,
  igdbListGenres, igdbGetCompany,
} from "./igdb-tool.js";

import {
  speedrunSearchGames, speedrunGetGame, speedrunGetLeaderboard,
  speedrunListRuns, speedrunGetUser,
} from "./speedrun-tool.js";

import {
  exchangerateLatest, exchangerateConvert,
  exchangerateHistorical, exchangerateCodes,
} from "./exchangerate-tool.js";

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL_TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const ADDITIONAL_TOOLS = [

  // ── bgg-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "bgg_search",
    description: "Search BoardGameGeek for board games by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Game name to search for" },
        type: { type: "string", enum: ["boardgame", "boardgameexpansion"], description: "Type of item to search for (default: boardgame)" },
      },
      required: ["query"],
    },
  },
  {
    name: "bgg_game_details",
    description: "Get full details for a board game by its BGG ID — name, year, rating, players, playtime, description, categories, and mechanics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gameId: { type: "string", description: "BoardGameGeek game ID" },
      },
      required: ["gameId"],
    },
  },
  {
    name: "bgg_user_collection",
    description: "Get a BGG user's game collection filtered by status (owned, wishlist, or played).",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "BGG username" },
        status: { type: "string", enum: ["owned", "wishlist", "played"], description: "Collection filter (default: owned)" },
      },
      required: ["username"],
    },
  },
  {
    name: "bgg_top_games",
    description: "Get the BGG Hotness list — the most discussed and active board games right now.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of games to return (max 50, default 20)" },
      },
    },
  },
  {
    name: "bgg_game_reviews",
    description: "Get user comments and ratings for a board game on BGG.",
    inputSchema: {
      type: "object" as const,
      properties: {
        gameId: { type: "string", description: "BoardGameGeek game ID" },
        page: { type: "number", description: "Page number (default 1, 25 comments per page)" },
      },
      required: ["gameId"],
    },
  },

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

  // ── gdelt-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "gdelt_news_search",
    description: "Search global news via the GDELT Project. Returns article titles, URLs, sources, dates, countries, and languages. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (keywords, phrases, or operators)" },
        maxrecords: { type: "number", description: "Max articles to return (default 25, max 250)" },
        startdatetime: { type: "string", description: "Start datetime YYYYMMDDHHMMSS (UTC)" },
        enddatetime: { type: "string", description: "End datetime YYYYMMDDHHMMSS (UTC)" },
        sourcelang: { type: "string", description: "Filter by source language (e.g. 'english', 'spanish')" },
        sourcecountry: { type: "string", description: "Filter by source country code (e.g. 'US', 'GB', 'AU')" },
      },
      required: ["query"],
    },
  },
  {
    name: "gdelt_tone_analysis",
    description: "Analyse the sentiment and tone of global news coverage for a topic over time. Returns average tone scores (negative = negative coverage, positive = positive), trend summary, and timeline. Great for brand monitoring or tracking public sentiment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Topic or keyword to analyse" },
        timespan: { type: "string", description: "Time window (e.g. '24h', '7d', '1month')" },
        sourcelang: { type: "string", description: "Filter by source language" },
        sourcecountry: { type: "string", description: "Filter by source country code" },
      },
      required: ["query"],
    },
  },
  {
    name: "gdelt_geo_events",
    description: "Get geographic distribution of news events for a topic from the GDELT GEO API. Returns event clusters with location, article count, and tone score.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Topic or keyword to map" },
        maxpoints: { type: "number", description: "Max location clusters to return (default 50, max 250)" },
        timespan: { type: "string", description: "Time window (e.g. '24h', '7d')" },
      },
      required: ["query"],
    },
  },
  {
    name: "gdelt_trending",
    description: "Check whether a topic is trending in global news using GDELT article volume timelines. Returns a trend classification (surging, rising, stable, declining, fading) and volume data over time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Topic or keyword to check" },
        timespan: { type: "string", description: "Time window (e.g. '24h', '7d', '1month')" },
        sourcelang: { type: "string", description: "Filter by source language" },
      },
      required: ["query"],
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

  // ── line-tool.ts ──────────────────────────────────────────────────────────────
  {
    name: "line_send_message",
    description: "Send a text message to a LINE user, group, or room.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        to: { type: "string", description: "User ID, group ID, or room ID" },
        message: { type: "string" },
      },
      required: ["channel_access_token", "to", "message"],
    },
  },
  {
    name: "line_send_flex_message",
    description: "Send a rich Flex Message to a LINE user or group.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        to: { type: "string" },
        alt_text: { type: "string", description: "Fallback text shown in push notifications" },
        contents: { description: "Flex Message container as JSON object or string" },
      },
      required: ["channel_access_token", "to", "alt_text", "contents"],
    },
  },
  {
    name: "line_get_profile",
    description: "Get a LINE user's display name, profile picture, and status message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        user_id: { type: "string" },
      },
      required: ["channel_access_token", "user_id"],
    },
  },
  {
    name: "line_get_group_summary",
    description: "Get a LINE group's name and picture URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        group_id: { type: "string" },
      },
      required: ["channel_access_token", "group_id"],
    },
  },
  {
    name: "line_reply_message",
    description: "Reply to a LINE message using a reply token from a webhook event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        reply_token: { type: "string" },
        messages: { description: "Array of LINE message objects (max 5), or use message for a single text reply" },
        message: { type: "string", description: "Convenience: single text message to reply with" },
      },
      required: ["channel_access_token", "reply_token"],
    },
  },
  {
    name: "line_broadcast",
    description: "Broadcast a text message to all followers of your LINE Official Account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_access_token: { type: "string" },
        message: { type: "string" },
      },
      required: ["channel_access_token", "message"],
    },
  },

  // ── figma-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "figma_get_file",
    description: "Get a Figma file's structure and metadata — pages, frames, and component count.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string", description: "Alphanumeric file ID from the Figma URL" },
        depth: { type: "number", description: "How deep to traverse the node tree (default: full)" },
      },
      required: ["personal_access_token", "file_key"],
    },
  },
  {
    name: "figma_get_node",
    description: "Get a specific node by ID within a Figma file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string" },
        node_id: { type: "string", description: "Node ID (e.g. '1:2' or '1-2')" },
      },
      required: ["personal_access_token", "file_key", "node_id"],
    },
  },
  {
    name: "figma_get_images",
    description: "Export/render Figma nodes as images (PNG, JPG, SVG, or PDF).",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string" },
        node_ids: { description: "Comma-separated node IDs or array of node ID strings" },
        format: { type: "string", description: "png, jpg, svg, or pdf (default: png)" },
        scale: { type: "number", description: "Image scale factor 0.01–4 (default: 1, PNG/JPG only)" },
      },
      required: ["personal_access_token", "file_key", "node_ids"],
    },
  },
  {
    name: "figma_get_comments",
    description: "Get all comments on a Figma file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string" },
      },
      required: ["personal_access_token", "file_key"],
    },
  },
  {
    name: "figma_post_comment",
    description: "Add a comment to a Figma file, optionally pinned to canvas coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string" },
        message: { type: "string" },
        x: { type: "number", description: "Canvas X coordinate to pin the comment" },
        y: { type: "number", description: "Canvas Y coordinate to pin the comment" },
      },
      required: ["personal_access_token", "file_key", "message"],
    },
  },
  {
    name: "figma_get_components",
    description: "Get all published components in a Figma file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        file_key: { type: "string" },
      },
      required: ["personal_access_token", "file_key"],
    },
  },
  {
    name: "figma_get_team_projects",
    description: "List all projects for a Figma team.",
    inputSchema: {
      type: "object" as const,
      properties: {
        personal_access_token: { type: "string" },
        team_id: { type: "string", description: "Team ID from your Figma team URL" },
      },
      required: ["personal_access_token", "team_id"],
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

  // ── ebay-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "ebay_search",
    description: "Search eBay listings via the Browse API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:     { type: "string", description: "eBay application Client ID" },
        client_secret: { type: "string", description: "eBay application Client Secret" },
        q:             { type: "string", description: "Search query" },
        limit:         { type: "number", description: "Results per page (max 200, default 20)" },
        offset:        { type: "number" },
        filter:        { type: "string", description: "eBay filter string (e.g. price:[10..50])" },
        sort:          { type: "string", description: "Sort order (e.g. price, -price, newlyListed)" },
        category_ids:  { type: "string", description: "Comma-separated category IDs" },
        marketplace:   { type: "string", description: "Marketplace ID (default: EBAY_US)" },
      },
      required: ["client_id", "client_secret", "q"],
    },
  },
  {
    name: "ebay_get_item",
    description: "Get full details for an eBay item by item ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:     { type: "string" },
        client_secret: { type: "string" },
        item_id:       { type: "string", description: "eBay item ID (e.g. v1|123456789|0)" },
        fieldgroups:   { type: "string" },
        marketplace:   { type: "string" },
      },
      required: ["client_id", "client_secret", "item_id"],
    },
  },
  {
    name: "ebay_get_item_by_legacy_id",
    description: "Get an eBay item by its legacy item ID (classic numeric ID).",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:            { type: "string" },
        client_secret:        { type: "string" },
        legacy_item_id:       { type: "string", description: "Legacy eBay item ID (numeric)" },
        legacy_variation_id:  { type: "string" },
        legacy_variation_sku: { type: "string" },
        marketplace:          { type: "string" },
      },
      required: ["client_id", "client_secret", "legacy_item_id"],
    },
  },
  {
    name: "ebay_get_categories",
    description: "Get the eBay category tree for a marketplace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:        { type: "string" },
        client_secret:    { type: "string" },
        category_tree_id: { type: "string", description: "Category tree ID (0 = US default)" },
        marketplace:      { type: "string" },
      },
      required: ["client_id", "client_secret"],
    },
  },

  // ── etsy-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "etsy_search_listings",
    description: "Search active Etsy listings by keyword.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:     { type: "string", description: "Etsy API key" },
        keywords:    { type: "string", description: "Search keywords" },
        limit:       { type: "number", description: "Results per page (max 100, default 25)" },
        offset:      { type: "number" },
        sort_on:     { type: "string", description: "Sort field (created, price, score, updated)" },
        sort_order:  { type: "string", description: "asc or desc" },
        min_price:   { type: "number" },
        max_price:   { type: "number" },
        taxonomy_id: { type: "number" },
        location:    { type: "string" },
      },
      required: ["api_key", "keywords"],
    },
  },
  {
    name: "etsy_get_listing",
    description: "Get details for a single Etsy listing by listing ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:    { type: "string" },
        listing_id: { type: "string" },
        includes:   { type: "string", description: "Comma-separated includes (Images, Shop, etc.)" },
      },
      required: ["api_key", "listing_id"],
    },
  },
  {
    name: "etsy_get_shop",
    description: "Get details for an Etsy shop by shop ID or numeric ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        shop_id: { type: "string", description: "Shop ID or shop name" },
      },
      required: ["api_key", "shop_id"],
    },
  },
  {
    name: "etsy_get_shop_listings",
    description: "Get active listings for an Etsy shop.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:    { type: "string" },
        shop_id:    { type: "string" },
        limit:      { type: "number" },
        offset:     { type: "number" },
        sort_on:    { type: "string" },
        sort_order: { type: "string" },
      },
      required: ["api_key", "shop_id"],
    },
  },
  {
    name: "etsy_search_shops",
    description: "Search for Etsy shops by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key:   { type: "string" },
        shop_name: { type: "string", description: "Shop name to search for" },
        limit:     { type: "number" },
        offset:    { type: "number" },
      },
      required: ["api_key", "shop_name"],
    },
  },

  // ── stripe-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "stripe_customers",
    description: "List or create Stripe customers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string", description: "Stripe secret key (sk_live_* or sk_test_*)" },
        action:         { type: "string", description: "list or create (default: list)" },
        limit:          { type: "number" },
        starting_after: { type: "string", description: "Pagination cursor (customer ID)" },
        email:          { type: "string" },
        name:           { type: "string" },
        phone:          { type: "string" },
        description:    { type: "string" },
      },
      required: ["secret_key"],
    },
  },
  {
    name: "stripe_charges",
    description: "List or create Stripe charges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string" },
        action:         { type: "string", description: "list or create (default: list)" },
        limit:          { type: "number" },
        starting_after: { type: "string" },
        customer:       { type: "string" },
        amount:         { type: "number", description: "Amount in smallest currency unit (e.g. cents)" },
        currency:       { type: "string", description: "ISO currency code (e.g. usd)" },
        source:         { type: "string", description: "Payment source or token" },
        description:    { type: "string" },
      },
      required: ["secret_key"],
    },
  },
  {
    name: "stripe_subscriptions",
    description: "List Stripe subscriptions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string" },
        limit:          { type: "number" },
        starting_after: { type: "string" },
        customer:       { type: "string" },
        status:         { type: "string", description: "active, past_due, canceled, etc." },
        price:          { type: "string" },
      },
      required: ["secret_key"],
    },
  },
  {
    name: "stripe_invoices",
    description: "List Stripe invoices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string" },
        limit:          { type: "number" },
        starting_after: { type: "string" },
        customer:       { type: "string" },
        status:         { type: "string", description: "draft, open, paid, uncollectible, void" },
        subscription:   { type: "string" },
      },
      required: ["secret_key"],
    },
  },
  {
    name: "stripe_products",
    description: "List Stripe products.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string" },
        limit:          { type: "number" },
        starting_after: { type: "string" },
        active:         { type: "boolean" },
      },
      required: ["secret_key"],
    },
  },
  {
    name: "stripe_prices",
    description: "List Stripe prices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        secret_key:     { type: "string" },
        limit:          { type: "number" },
        starting_after: { type: "string" },
        product:        { type: "string" },
        active:         { type: "boolean" },
        type:           { type: "string", description: "one_time or recurring" },
      },
      required: ["secret_key"],
    },
  },

  // ── paypal-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "paypal_orders",
    description: "Create or retrieve a PayPal order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:      { type: "string", description: "PayPal application Client ID" },
        client_secret:  { type: "string", description: "PayPal application Client Secret" },
        action:         { type: "string", description: "create or get (default: get)" },
        order_id:       { type: "string", description: "Required for action='get'" },
        intent:         { type: "string", description: "CAPTURE or AUTHORIZE (default: CAPTURE)" },
        purchase_units: { type: "array", description: "Required for action='create'" },
        sandbox:        { type: "boolean", description: "Use PayPal sandbox (default: false)" },
      },
      required: ["client_id", "client_secret"],
    },
  },
  {
    name: "paypal_invoices",
    description: "List, create, or send PayPal invoices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:      { type: "string" },
        client_secret:  { type: "string" },
        action:         { type: "string", description: "list, create, or send (default: list)" },
        invoice_id:     { type: "string", description: "Required for action='send'" },
        invoice:        { type: "object", description: "Invoice object for action='create'" },
        page:           { type: "number" },
        page_size:      { type: "number" },
        sandbox:        { type: "boolean" },
      },
      required: ["client_id", "client_secret"],
    },
  },

  // ── square-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "square_payments",
    description: "List or create Square payments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token:  { type: "string", description: "Square access token" },
        action:        { type: "string", description: "list or create (default: list)" },
        begin_time:    { type: "string", description: "RFC 3339 timestamp" },
        end_time:      { type: "string" },
        cursor:        { type: "string" },
        limit:         { type: "number" },
        source_id:     { type: "string", description: "Required for action='create'" },
        amount_money:  { type: "object", description: "{amount: number, currency: string}" },
        idempotency_key: { type: "string" },
        customer_id:   { type: "string" },
        note:          { type: "string" },
      },
      required: ["access_token"],
    },
  },
  {
    name: "square_customers",
    description: "List Square customers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        cursor:       { type: "string" },
        limit:        { type: "number" },
        sort_field:   { type: "string" },
        sort_order:   { type: "string" },
      },
      required: ["access_token"],
    },
  },
  {
    name: "square_catalog_list",
    description: "List Square catalog objects (items, categories, taxes, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        cursor:       { type: "string" },
        types:        { type: "string", description: "Comma-separated types (ITEM, CATEGORY, etc.)" },
        limit:        { type: "number" },
      },
      required: ["access_token"],
    },
  },
  {
    name: "square_catalog_search",
    description: "Search Square catalog objects by text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        text_filter:  { type: "string", description: "Text to search for" },
        object_types: { type: "array", description: "Types to search (default: ['ITEM'])" },
        limit:        { type: "number" },
        cursor:       { type: "string" },
      },
      required: ["access_token", "text_filter"],
    },
  },

  // ── quickbooks-tool.ts ────────────────────────────────────────────────────────
  {
    name: "quickbooks_customers",
    description: "Query QuickBooks Online customers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "QuickBooks OAuth2 access token" },
        realm_id:     { type: "string", description: "QuickBooks company realm ID" },
        where:        { type: "string", description: "SQL-style WHERE clause (e.g. Active = true)" },
        limit:        { type: "number" },
        offset:       { type: "number" },
        sandbox:      { type: "boolean" },
      },
      required: ["access_token", "realm_id"],
    },
  },
  {
    name: "quickbooks_invoices",
    description: "List, get, or create QuickBooks Online invoices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        realm_id:     { type: "string" },
        action:       { type: "string", description: "list, get, or create (default: list)" },
        invoice_id:   { type: "string", description: "Required for action='get'" },
        invoice:      { type: "object", description: "Invoice object for action='create'" },
        where:        { type: "string" },
        limit:        { type: "number" },
        offset:       { type: "number" },
        sandbox:      { type: "boolean" },
      },
      required: ["access_token", "realm_id"],
    },
  },
  {
    name: "quickbooks_items",
    description: "Query QuickBooks Online items (products and services).",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        realm_id:     { type: "string" },
        where:        { type: "string" },
        limit:        { type: "number" },
        offset:       { type: "number" },
        sandbox:      { type: "boolean" },
      },
      required: ["access_token", "realm_id"],
    },
  },
  {
    name: "quickbooks_payments",
    description: "Query QuickBooks Online payments.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
        realm_id:     { type: "string" },
        where:        { type: "string" },
        limit:        { type: "number" },
        offset:       { type: "number" },
        sandbox:      { type: "boolean" },
      },
      required: ["access_token", "realm_id"],
    },
  },

  // ── plaid-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "plaid_accounts",
    description: "Get accounts for a Plaid-linked item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:    { type: "string", description: "Plaid client ID" },
        secret:       { type: "string", description: "Plaid secret key" },
        access_token: { type: "string", description: "Plaid item access token" },
        account_ids:  { type: "array", description: "Filter to specific account IDs" },
        environment:  { type: "string", description: "sandbox, development, or production (default: sandbox)" },
      },
      required: ["client_id", "secret", "access_token"],
    },
  },
  {
    name: "plaid_transactions",
    description: "Get transactions for a Plaid-linked item within a date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:    { type: "string" },
        secret:       { type: "string" },
        access_token: { type: "string" },
        start_date:   { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date:     { type: "string", description: "End date (YYYY-MM-DD)" },
        count:        { type: "number", description: "Number of transactions (max 500, default 100)" },
        offset:       { type: "number" },
        account_ids:  { type: "array" },
        environment:  { type: "string" },
      },
      required: ["client_id", "secret", "access_token", "start_date", "end_date"],
    },
  },
  {
    name: "plaid_balances",
    description: "Get real-time account balances for a Plaid-linked item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:    { type: "string" },
        secret:       { type: "string" },
        access_token: { type: "string" },
        account_ids:  { type: "array" },
        environment:  { type: "string" },
      },
      required: ["client_id", "secret", "access_token"],
    },
  },
  {
    name: "plaid_identity",
    description: "Get identity information for accounts linked via Plaid.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:    { type: "string" },
        secret:       { type: "string" },
        access_token: { type: "string" },
        environment:  { type: "string" },
      },
      required: ["client_id", "secret", "access_token"],
    },
  },
  {
    name: "plaid_link_token_create",
    description: "Create a Plaid Link token to initialise the Plaid Link flow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id:             { type: "string" },
        secret:                { type: "string" },
        user_client_user_id:   { type: "string", description: "Unique identifier for the end user" },
        client_name:           { type: "string", description: "App name shown in Plaid Link UI" },
        products:              { type: "array", description: "Plaid products (default: ['transactions'])" },
        country_codes:         { type: "array", description: "ISO country codes (default: ['US'])" },
        language:              { type: "string", description: "Language code (default: en)" },
        webhook:               { type: "string" },
        access_token:          { type: "string", description: "For update mode: existing access token" },
        environment:           { type: "string" },
      },
      required: ["client_id", "secret", "user_client_user_id"],
    },
  },

  // ── woocommerce-tool.ts ───────────────────────────────────────────────────────
  {
    name: "woo_products",
    description: "List or get WooCommerce products.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store_url:       { type: "string", description: "WooCommerce store URL (e.g. https://mystore.com)" },
        consumer_key:    { type: "string", description: "WooCommerce consumer key (ck_...)" },
        consumer_secret: { type: "string", description: "WooCommerce consumer secret (cs_...)" },
        action:          { type: "string", description: "list or get (default: list)" },
        id:              { type: "string", description: "Product ID for action='get'" },
        per_page:        { type: "number" },
        page:            { type: "number" },
        status:          { type: "string", description: "publish, draft, pending, private" },
        category:        { type: "string" },
        search:          { type: "string" },
        orderby:         { type: "string" },
        order:           { type: "string" },
      },
      required: ["store_url", "consumer_key", "consumer_secret"],
    },
  },
  {
    name: "woo_orders",
    description: "List, get, or create WooCommerce orders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store_url:       { type: "string" },
        consumer_key:    { type: "string" },
        consumer_secret: { type: "string" },
        action:          { type: "string", description: "list, get, or create (default: list)" },
        id:              { type: "string", description: "Order ID for action='get'" },
        order:           { type: "object", description: "Order object for action='create'" },
        per_page:        { type: "number" },
        page:            { type: "number" },
        status:          { type: "string", description: "pending, processing, completed, refunded, etc." },
        customer:        { type: "number", description: "Filter by customer ID" },
        after:           { type: "string", description: "ISO 8601 date for orders after this date" },
        before:          { type: "string" },
      },
      required: ["store_url", "consumer_key", "consumer_secret"],
    },
  },
  {
    name: "woo_customers",
    description: "List WooCommerce customers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        store_url:       { type: "string" },
        consumer_key:    { type: "string" },
        consumer_secret: { type: "string" },
        per_page:        { type: "number" },
        page:            { type: "number" },
        search:          { type: "string" },
        email:           { type: "string" },
        role:            { type: "string" },
        orderby:         { type: "string" },
        order:           { type: "string" },
      },
      required: ["store_url", "consumer_key", "consumer_secret"],
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

  // ── github-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "github_action",
    description: "Interact with the GitHub REST API: search repos, get repo details, list and create issues, list PRs, get user profiles, list gists, and search code.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:       { type: "string", description: "Action: search_repos, get_repo, list_issues, create_issue, list_prs, get_user, list_gists, search_code." },
        access_token: { type: "string", description: "GitHub personal access token (PAT). Public data works without a token." },
        query:        { type: "string", description: "Search query string (for search_repos and search_code)." },
        owner:        { type: "string", description: "Repository owner login." },
        repo:         { type: "string", description: "Repository name." },
        title:        { type: "string", description: "Issue title (for create_issue)." },
        body:         { type: "string", description: "Issue body text (for create_issue)." },
        state:        { type: "string", description: "Filter by state: open, closed, all." },
        labels:       { type: "string", description: "Comma-separated label names to filter by." },
        username:     { type: "string", description: "GitHub username (for get_user and list_gists)." },
        per_page:     { type: "number", description: "Results per page (max 100)." },
        page:         { type: "number", description: "Page number." },
      },
      required: ["action"],
    },
  },

  // ── gitlab-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "gitlab_action",
    description: "Interact with the GitLab REST API: search projects, get project details, list issues and merge requests, and look up users. Supports self-hosted GitLab instances.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:       { type: "string", description: "Action: search_projects, get_project, list_issues, list_mrs, get_user." },
        access_token: { type: "string", description: "GitLab personal access token (PAT)." },
        base_url:     { type: "string", description: "GitLab base URL (default: https://gitlab.com/api/v4). Set for self-hosted instances." },
        query:        { type: "string", description: "Search query string (for search_projects)." },
        project_id:   { type: "string", description: "Project ID or URL-encoded namespace/project path." },
        state:        { type: "string", description: "Filter by state: opened, closed, merged." },
        labels:       { type: "string", description: "Comma-separated label names to filter by." },
        username:     { type: "string", description: "GitLab username (for get_user)." },
        per_page:     { type: "number", description: "Results per page." },
        page:         { type: "number", description: "Page number." },
      },
      required: ["action"],
    },
  },

  // ── clickup-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "clickup_action",
    description: "Interact with the ClickUp API v2: list workspaces and spaces, get lists and tasks, create tasks, and update task properties.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:      { type: "string", description: "Action: get_workspaces, get_spaces, get_lists, get_tasks, create_task, update_task." },
        api_key:     { type: "string", description: "ClickUp API key." },
        team_id:     { type: "string", description: "Workspace (team) ID (for get_spaces)." },
        space_id:    { type: "string", description: "Space ID (for get_lists without a folder)." },
        folder_id:   { type: "string", description: "Folder ID (for get_lists)." },
        list_id:     { type: "string", description: "List ID (for get_tasks and create_task)." },
        task_id:     { type: "string", description: "Task ID (for update_task)." },
        name:        { type: "string", description: "Task name (for create_task and update_task)." },
        description: { type: "string", description: "Task description." },
        status:      { type: "string", description: "Task status name." },
        priority:    { type: "number", description: "Priority: 1 (urgent), 2 (high), 3 (normal), 4 (low)." },
        due_date:    { type: "number", description: "Due date as Unix timestamp in milliseconds." },
        page:        { type: "number", description: "Page number for task pagination." },
      },
      required: ["action", "api_key"],
    },
  },

  // ── linear-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "linear_action",
    description: "Interact with the Linear GraphQL API: list and search issues, create issues, get project details, and list teams.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:      { type: "string", description: "Action: list_issues, create_issue, get_project, list_teams, search_issues." },
        api_key:     { type: "string", description: "Linear API key." },
        title:       { type: "string", description: "Issue title (for create_issue)." },
        team_id:     { type: "string", description: "Team ID (required for create_issue, optional filter for list_issues)." },
        project_id:  { type: "string", description: "Project ID (for get_project)." },
        description: { type: "string", description: "Issue description." },
        priority:    { type: "number", description: "Priority: 0 (none), 1 (urgent), 2 (high), 3 (medium), 4 (low)." },
        assignee_id: { type: "string", description: "Assignee user ID." },
        state_id:    { type: "string", description: "Workflow state ID." },
        query:       { type: "string", description: "Search term (for search_issues)." },
        first:       { type: "number", description: "Number of results to return (default 25)." },
      },
      required: ["action", "api_key"],
    },
  },

  // ── airtable-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "airtable_action",
    description: "Interact with the Airtable REST API: list bases, list and search records, get a single record, and create or update records.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:       { type: "string", description: "Action: list_bases, list_records, get_record, create_record, update_record, search_records." },
        access_token: { type: "string", description: "Airtable personal access token (PAT)." },
        base_id:      { type: "string", description: "Airtable base ID (starts with 'app')." },
        table_name:   { type: "string", description: "Table name or ID." },
        record_id:    { type: "string", description: "Record ID (starts with 'rec')." },
        fields:       { type: "object", description: "Record fields as key-value pairs (for create_record and update_record)." },
        formula:      { type: "string", description: "Airtable filter formula string (for search_records)." },
        view:         { type: "string", description: "View name or ID to use." },
        max_records:  { type: "number", description: "Maximum number of records to return." },
        page_size:    { type: "number", description: "Number of records per page (max 100)." },
        offset:       { type: "string", description: "Pagination offset token." },
      },
      required: ["action", "access_token"],
    },
  },

  // ── trello-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "trello_action",
    description: "Interact with the Trello REST API: list boards and lists, get and search cards, create cards, and update card properties.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:    { type: "string", description: "Action: get_boards, get_lists, get_cards, create_card, update_card, search_cards." },
        api_key:   { type: "string", description: "Trello API key." },
        token:     { type: "string", description: "Trello user token." },
        board_id:  { type: "string", description: "Board ID." },
        list_id:   { type: "string", description: "List ID." },
        card_id:   { type: "string", description: "Card ID (for update_card)." },
        name:      { type: "string", description: "Card name (for create_card and update_card)." },
        desc:      { type: "string", description: "Card description." },
        due:       { type: "string", description: "Due date as ISO 8601 string." },
        due_complete: { type: "boolean", description: "Whether the due date is marked complete." },
        closed:    { type: "boolean", description: "Archive or unarchive the card." },
        id_list:   { type: "string", description: "Move card to this list ID." },
        pos:       { type: "string", description: "Card position: top, bottom, or a positive float." },
        query:     { type: "string", description: "Search query (for search_cards)." },
        member_id: { type: "string", description: "Member ID for get_boards (default: me)." },
        filter:    { type: "string", description: "Filter for boards or lists: open, closed, all." },
        limit:     { type: "number", description: "Max results for search_cards." },
      },
      required: ["action", "api_key", "token"],
    },
  },

  // ── sentry-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "sentry_action",
    description: "Interact with the Sentry REST API: list projects and issues, get issue details and events, and resolve issues.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:            { type: "string", description: "Action: list_projects, list_issues, get_issue, list_events, resolve_issue." },
        auth_token:        { type: "string", description: "Sentry auth token." },
        organization_slug: { type: "string", description: "Sentry organization slug." },
        project_slug:      { type: "string", description: "Sentry project slug." },
        issue_id:          { type: "string", description: "Issue ID (for get_issue, list_events, resolve_issue)." },
        query:             { type: "string", description: "Search query to filter issues." },
        stats_period:      { type: "string", description: "Time window for issue stats: 24h, 14d, etc." },
        limit:             { type: "number", description: "Max number of results." },
        cursor:            { type: "string", description: "Pagination cursor." },
      },
      required: ["action", "auth_token"],
    },
  },

  // ── postman-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "postman_action",
    description: "Interact with the Postman API: list and retrieve collections, list environments, and list monitors.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action:        { type: "string", description: "Action: list_collections, get_collection, list_environments, list_monitors." },
        api_key:       { type: "string", description: "Postman API key." },
        collection_id: { type: "string", description: "Collection UID (for get_collection)." },
        workspace_id:  { type: "string", description: "Workspace ID to filter results." },
      },
      required: ["action", "api_key"],
    },
  },

  // ── twilio-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "twilio_send_sms",
    description: "Send an SMS via Twilio.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        to: { type: "string", description: "Recipient phone number in E.164 format" },
        from: { type: "string", description: "Your Twilio phone number or messaging service SID" },
        body: { type: "string", description: "Message text" },
        status_callback: { type: "string", description: "URL to receive status updates" },
      },
      required: ["account_sid", "auth_token", "to", "from", "body"],
    },
  },
  {
    name: "twilio_list_messages",
    description: "List SMS messages sent or received on a Twilio account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        to: { type: "string" },
        from: { type: "string" },
        date_sent: { type: "string", description: "Filter by date (YYYY-MM-DD)" },
        page_size: { type: "number" },
      },
      required: ["account_sid", "auth_token"],
    },
  },
  {
    name: "twilio_get_message",
    description: "Get a single Twilio message by SID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        message_sid: { type: "string" },
      },
      required: ["account_sid", "auth_token", "message_sid"],
    },
  },
  {
    name: "twilio_make_call",
    description: "Initiate an outbound phone call via Twilio.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        to: { type: "string", description: "E.164 phone number to call" },
        from: { type: "string", description: "Your Twilio phone number" },
        twiml: { type: "string", description: "TwiML instructions for the call" },
        url: { type: "string", description: "URL that returns TwiML for the call" },
      },
      required: ["account_sid", "auth_token", "to", "from"],
    },
  },
  {
    name: "twilio_list_calls",
    description: "List outbound and inbound calls on a Twilio account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        to: { type: "string" },
        from: { type: "string" },
        status: { type: "string", description: "queued, ringing, in-progress, completed, failed, busy, no-answer" },
        page_size: { type: "number" },
      },
      required: ["account_sid", "auth_token"],
    },
  },
  {
    name: "twilio_send_verify",
    description: "Send a verification code via Twilio Verify (SMS, call, email, or WhatsApp).",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        service_sid: { type: "string", description: "Twilio Verify Service SID" },
        to: { type: "string", description: "E.164 phone number or email" },
        channel: { type: "string", description: "sms, call, email, or whatsapp (default: sms)" },
      },
      required: ["account_sid", "auth_token", "service_sid", "to"],
    },
  },
  {
    name: "twilio_check_verify",
    description: "Check a verification code submitted by a user via Twilio Verify.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_sid: { type: "string" },
        auth_token: { type: "string" },
        service_sid: { type: "string" },
        to: { type: "string" },
        code: { type: "string", description: "The OTP code entered by the user" },
      },
      required: ["account_sid", "auth_token", "service_sid", "to", "code"],
    },
  },

  // ── pushover-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "pushover_send_notification",
    description: "Send a push notification via Pushover.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string" },
        user_key: { type: "string" },
        message: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
        url_title: { type: "string" },
        priority: { type: "number", description: "-2 (lowest) to 2 (emergency)" },
        sound: { type: "string" },
        device: { type: "string" },
        html: { type: "boolean" },
        retry: { type: "number", description: "Emergency only: retry interval in seconds (min 30)" },
        expire: { type: "number", description: "Emergency only: expiry in seconds (max 10800)" },
      },
      required: ["app_token", "user_key", "message"],
    },
  },
  {
    name: "pushover_get_receipt",
    description: "Get acknowledgment status for an emergency Pushover notification.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string" },
        receipt: { type: "string", description: "Receipt token returned from an emergency notification" },
      },
      required: ["app_token", "receipt"],
    },
  },
  {
    name: "pushover_cancel_emergency",
    description: "Cancel an outstanding emergency Pushover notification before it expires.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string" },
        user_key: { type: "string" },
        receipt: { type: "string" },
      },
      required: ["app_token", "user_key", "receipt"],
    },
  },
  {
    name: "pushover_list_sounds",
    description: "List all available notification sounds in Pushover.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string" },
      },
      required: ["app_token"],
    },
  },
  {
    name: "pushover_validate_user",
    description: "Validate a Pushover user or group key and list their registered devices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string" },
        user_key: { type: "string" },
        device: { type: "string", description: "Optional: validate only for a specific device name" },
      },
      required: ["app_token", "user_key"],
    },
  },

  // ── whatsapp-tool.ts ──────────────────────────────────────────────────────────
  {
    name: "whatsapp_send_text",
    description: "Send a text message via WhatsApp Business Cloud API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        phone_number_id: { type: "string", description: "Your WhatsApp phone number ID from Meta for Developers" },
        to: { type: "string", description: "Recipient phone number in E.164 format" },
        body: { type: "string", description: "Message text" },
        preview_url: { type: "boolean" },
      },
      required: ["bearer_token", "phone_number_id", "to", "body"],
    },
  },
  {
    name: "whatsapp_send_template",
    description: "Send a WhatsApp template message (required for first contact or >24h since last message).",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        phone_number_id: { type: "string" },
        to: { type: "string" },
        template_name: { type: "string" },
        language: { type: "string", description: "Language code, e.g. en_US (default)" },
        components: { description: "Array of template component objects for variable substitution" },
      },
      required: ["bearer_token", "phone_number_id", "to", "template_name"],
    },
  },
  {
    name: "whatsapp_send_media",
    description: "Send a media message (image, video, audio, document, sticker) via WhatsApp.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        phone_number_id: { type: "string" },
        to: { type: "string" },
        media_type: { type: "string", description: "image, video, audio, document, or sticker" },
        media_id: { type: "string", description: "ID of a previously uploaded media object" },
        media_link: { type: "string", description: "URL of the media to send" },
        caption: { type: "string" },
        filename: { type: "string", description: "For documents: the display filename" },
      },
      required: ["bearer_token", "phone_number_id", "to", "media_type"],
    },
  },
  {
    name: "whatsapp_get_media",
    description: "Get the download URL and metadata for a WhatsApp media object by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        media_id: { type: "string" },
      },
      required: ["bearer_token", "media_id"],
    },
  },
  {
    name: "whatsapp_upload_media",
    description: "Upload a media file to WhatsApp and get a media ID for use in messages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        phone_number_id: { type: "string" },
        media_url: { type: "string", description: "URL to fetch the media from" },
        mime_type: { type: "string", description: "MIME type, e.g. image/jpeg, video/mp4" },
        filename: { type: "string" },
      },
      required: ["bearer_token", "phone_number_id", "media_url", "mime_type"],
    },
  },

  // ── youtube-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "youtube_search",
    description: "Search YouTube for videos, channels, or playlists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        query: { type: "string" },
        type: { type: "string", description: "video, channel, or playlist (default: video)" },
        max_results: { type: "number" },
        order: { type: "string", description: "relevance, date, rating, viewCount, title" },
        channel_id: { type: "string" },
        published_after: { type: "string", description: "RFC 3339 datetime, e.g. 2024-01-01T00:00:00Z" },
        region_code: { type: "string" },
        page_token: { type: "string" },
      },
      required: ["api_key", "query"],
    },
  },
  {
    name: "youtube_get_video",
    description: "Get metadata, statistics, and content details for a YouTube video.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        video_id: { type: "string" },
      },
      required: ["api_key", "video_id"],
    },
  },
  {
    name: "youtube_get_channel",
    description: "Get metadata and statistics for a YouTube channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        channel_id: { type: "string" },
        handle: { type: "string", description: "Channel handle without @ (alternative to channel_id)" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "youtube_list_playlists",
    description: "List playlists belonging to a YouTube channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        channel_id: { type: "string" },
        max_results: { type: "number" },
        page_token: { type: "string" },
      },
      required: ["api_key", "channel_id"],
    },
  },
  {
    name: "youtube_list_playlist_items",
    description: "List videos in a YouTube playlist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        playlist_id: { type: "string" },
        max_results: { type: "number" },
        page_token: { type: "string" },
      },
      required: ["api_key", "playlist_id"],
    },
  },
  {
    name: "youtube_get_captions",
    description: "List available caption tracks for a YouTube video.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        video_id: { type: "string" },
      },
      required: ["api_key", "video_id"],
    },
  },

  // ── spotify-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "spotify_search",
    description: "Search Spotify for tracks, albums, artists, or playlists.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        query: { type: "string" },
        type: { type: "string", description: "Comma-separated: track, album, artist, playlist (default: track)" },
        limit: { type: "number" },
        offset: { type: "number" },
        market: { type: "string" },
      },
      required: ["bearer_token", "query"],
    },
  },
  {
    name: "spotify_get_track",
    description: "Get metadata for a Spotify track by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        track_id: { type: "string" },
        market: { type: "string" },
      },
      required: ["bearer_token", "track_id"],
    },
  },
  {
    name: "spotify_get_album",
    description: "Get metadata and track listing for a Spotify album.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        album_id: { type: "string" },
      },
      required: ["bearer_token", "album_id"],
    },
  },
  {
    name: "spotify_get_artist",
    description: "Get metadata and follower count for a Spotify artist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        artist_id: { type: "string" },
      },
      required: ["bearer_token", "artist_id"],
    },
  },
  {
    name: "spotify_get_playlist",
    description: "Get metadata and tracks for a Spotify playlist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        playlist_id: { type: "string" },
        market: { type: "string" },
      },
      required: ["bearer_token", "playlist_id"],
    },
  },
  {
    name: "spotify_get_recommendations",
    description: "Get Spotify track recommendations based on seed tracks, artists, or genres.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        seed_tracks: { type: "string", description: "Comma-separated Spotify track IDs (max 5 seeds total)" },
        seed_artists: { type: "string", description: "Comma-separated Spotify artist IDs" },
        seed_genres: { type: "string", description: "Comma-separated genre names" },
        limit: { type: "number" },
        market: { type: "string" },
        min_energy: { type: "number" },
        max_energy: { type: "number" },
        target_valence: { type: "number" },
        target_danceability: { type: "number" },
      },
      required: ["bearer_token"],
    },
  },
  {
    name: "spotify_get_audio_features",
    description: "Get audio analysis features (danceability, energy, tempo, etc.) for a Spotify track.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bearer_token: { type: "string" },
        track_id: { type: "string" },
      },
      required: ["bearer_token", "track_id"],
    },
  },

  // ── elevenlabs-tool.ts ────────────────────────────────────────────────────────
  {
    name: "elevenlabs_list_voices",
    description: "List all available voices in ElevenLabs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "elevenlabs_get_voice",
    description: "Get metadata for a specific ElevenLabs voice by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        voice_id: { type: "string" },
        with_settings: { type: "boolean", description: "Include voice settings (stability, similarity_boost)" },
      },
      required: ["api_key", "voice_id"],
    },
  },
  {
    name: "elevenlabs_text_to_speech",
    description: "Convert text to speech with a selected ElevenLabs voice. Returns base64-encoded audio.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        voice_id: { type: "string" },
        text: { type: "string", description: "Text to synthesize (max 5000 characters)" },
        model_id: { type: "string", description: "ElevenLabs model ID (default: eleven_monolingual_v1)" },
        output_format: { type: "string", description: "mp3_44100_128, pcm_16000, etc. (default: mp3_44100_128)" },
        stability: { type: "number", description: "0.0-1.0 (default: 0.5)" },
        similarity_boost: { type: "number", description: "0.0-1.0 (default: 0.75)" },
        style: { type: "number", description: "0.0-1.0 style exaggeration" },
        use_speaker_boost: { type: "boolean" },
      },
      required: ["api_key", "voice_id", "text"],
    },
  },
  {
    name: "elevenlabs_get_models",
    description: "List available ElevenLabs TTS models and their supported languages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "elevenlabs_get_history",
    description: "Get the TTS generation history for an ElevenLabs account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        page_size: { type: "number" },
        voice_id: { type: "string", description: "Filter history by voice ID" },
        start_after_history_item_id: { type: "string" },
      },
      required: ["api_key"],
    },
  },

  // ── replicate-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "replicate_list_models",
    description: "List public models available on Replicate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        cursor: { type: "string" },
      },
      required: ["api_token"],
    },
  },
  {
    name: "replicate_get_model",
    description: "Get details and latest version for a Replicate model.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        owner: { type: "string", description: "Model owner username" },
        model_name: { type: "string" },
      },
      required: ["api_token", "owner", "model_name"],
    },
  },
  {
    name: "replicate_create_prediction",
    description: "Run a Replicate model by creating a prediction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        version: { type: "string", description: "Model version ID (use this OR model)" },
        model: { type: "string", description: "Model as owner/name or owner/name:version (use this OR version)" },
        input: { description: "Model input parameters as JSON object or string" },
        webhook: { type: "string" },
        stream: { type: "boolean" },
      },
      required: ["api_token", "input"],
    },
  },
  {
    name: "replicate_get_prediction",
    description: "Get the status and output of a Replicate prediction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        prediction_id: { type: "string" },
      },
      required: ["api_token", "prediction_id"],
    },
  },
  {
    name: "replicate_list_predictions",
    description: "List recent predictions for a Replicate account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        cursor: { type: "string" },
      },
      required: ["api_token"],
    },
  },
  {
    name: "replicate_cancel_prediction",
    description: "Cancel a running Replicate prediction.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_token: { type: "string" },
        prediction_id: { type: "string" },
      },
      required: ["api_token", "prediction_id"],
    },
  },

  // ── stability-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "stability_text_to_image",
    description: "Generate images from a text prompt using Stability AI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        prompt: { type: "string" },
        engine_id: { type: "string", description: "Stability engine ID (default: stable-diffusion-xl-1024-v1-0)" },
        negative_prompt: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        steps: { type: "number", description: "Diffusion steps 10-150 (default: 30)" },
        cfg_scale: { type: "number", description: "Guidance scale 0-35 (default: 7)" },
        samples: { type: "number", description: "Number of images (max 10, default: 1)" },
        style_preset: { type: "string" },
        seed: { type: "number" },
      },
      required: ["api_key", "prompt"],
    },
  },
  {
    name: "stability_image_to_image",
    description: "Transform an existing image using a text prompt with Stability AI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        prompt: { type: "string" },
        image_url: { type: "string", description: "URL of the source image" },
        engine_id: { type: "string" },
        negative_prompt: { type: "string" },
        strength: { type: "number", description: "0.0-1.0: how much to change the image (default: 0.35)" },
        steps: { type: "number" },
        cfg_scale: { type: "number" },
        samples: { type: "number" },
      },
      required: ["api_key", "prompt", "image_url"],
    },
  },
  {
    name: "stability_upscale",
    description: "Upscale an image using Stability AI ESRGAN.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        image_url: { type: "string", description: "URL of the image to upscale" },
        width: { type: "number", description: "Target width in pixels (default: 2048)" },
        engine_id: { type: "string", description: "Upscale engine (default: esrgan-v1-x2plus)" },
      },
      required: ["api_key", "image_url"],
    },
  },
  {
    name: "stability_list_engines",
    description: "List all available Stability AI generation engines.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
      required: ["api_key"],
    },
  },

  // ── openai-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "openai_chat_completion",
    description: "Run a chat completion with an OpenAI model (GPT-4o, GPT-4, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        model: { type: "string", description: "Model ID, e.g. gpt-4o, gpt-4o-mini (default: gpt-4o-mini)" },
        prompt: { type: "string", description: "Convenience: single user message (alternative to messages array)" },
        system_prompt: { type: "string", description: "System instruction (used with prompt param)" },
        messages: { description: "Array of {role, content} message objects (alternative to prompt)" },
        max_tokens: { type: "number" },
        temperature: { type: "number" },
        top_p: { type: "number" },
        n: { type: "number" },
        response_format: { description: "e.g. {type: 'json_object'}" },
        seed: { type: "number" },
        org_id: { type: "string", description: "OpenAI organization ID (optional)" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "openai_create_embedding",
    description: "Create vector embeddings for text using an OpenAI embedding model.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        input: { description: "String or array of strings to embed" },
        model: { type: "string", description: "Embedding model (default: text-embedding-3-small)" },
        dimensions: { type: "number", description: "Number of output dimensions (for text-embedding-3-* models)" },
        org_id: { type: "string" },
      },
      required: ["api_key", "input"],
    },
  },
  {
    name: "openai_generate_image",
    description: "Generate images from a text prompt using DALL-E.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        prompt: { type: "string" },
        model: { type: "string", description: "dall-e-3 or dall-e-2 (default: dall-e-3)" },
        n: { type: "number", description: "Number of images to generate" },
        size: { type: "string", description: "1024x1024, 1792x1024, or 1024x1792 for DALL-E 3" },
        quality: { type: "string", description: "standard or hd (DALL-E 3 only)" },
        style: { type: "string", description: "natural or vivid (DALL-E 3 only)" },
        response_format: { type: "string", description: "url or b64_json (default: url)" },
      },
      required: ["api_key", "prompt"],
    },
  },
  {
    name: "openai_create_transcription",
    description: "Transcribe audio to text using OpenAI Whisper.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        audio_url: { type: "string", description: "URL of the audio file to transcribe" },
        model: { type: "string", description: "Transcription model (default: whisper-1)" },
        language: { type: "string", description: "ISO-639-1 language code (optional)" },
        response_format: { type: "string", description: "json, text, srt, verbose_json, vtt (default: json)" },
        prompt: { type: "string" },
        temperature: { type: "number" },
        filename: { type: "string" },
      },
      required: ["api_key", "audio_url"],
    },
  },
  {
    name: "openai_list_models",
    description: "List all OpenAI models available to the account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
      required: ["api_key"],
    },
  },

  // ── anthropic-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "anthropic_create_message",
    description: "Send a message to the Anthropic Messages API (Claude models). Useful for agents that need to call Claude programmatically or compare model outputs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
        model: { type: "string", description: "Claude model ID (default: claude-sonnet-4-6)" },
        prompt: { type: "string", description: "Convenience: single user message (alternative to messages array)" },
        messages: { description: "Array of {role, content} message objects" },
        system: { type: "string", description: "System prompt" },
        max_tokens: { type: "number", description: "Max tokens to generate (default: 1024)" },
        temperature: { type: "number" },
        top_p: { type: "number" },
        top_k: { type: "number" },
        stop_sequences: { description: "Array of stop sequences" },
      },
      required: ["api_key"],
    },
  },
  {
    name: "anthropic_list_models",
    description: "List all Claude models available via the Anthropic API.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string" },
      },
      required: ["api_key"],
    },
  },

  // ── asana-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "list_asana_workspaces",
    description: "List all Asana workspaces accessible by the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "Asana Personal Access Token (or set ASANA_API_KEY)" },
      },
    },
  },
  {
    name: "list_asana_projects",
    description: "List projects in an Asana workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_gid: { type: "string", description: "Workspace GID" },
        archived: { type: "boolean", description: "Include archived projects (default false)" },
        limit: { type: "number", description: "Max results (default 100)" },
        api_key: { type: "string" },
      },
      required: ["workspace_gid"],
    },
  },
  {
    name: "list_asana_tasks",
    description: "List tasks in an Asana project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_gid: { type: "string", description: "Project GID" },
        completed: { type: "boolean", description: "Filter to completed tasks only" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["project_gid"],
    },
  },
  {
    name: "create_asana_task",
    description: "Create a new task in Asana.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Task name" },
        workspace_gid: { type: "string", description: "Workspace GID" },
        notes: { type: "string", description: "Task description" },
        due_on: { type: "string", description: "Due date (YYYY-MM-DD)" },
        assignee: { type: "string", description: "Assignee GID or 'me'" },
        projects: { type: "array", items: { type: "string" }, description: "Project GIDs to add the task to" },
        api_key: { type: "string" },
      },
      required: ["name", "workspace_gid"],
    },
  },
  {
    name: "update_asana_task",
    description: "Update an existing Asana task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: { type: "string", description: "Task GID" },
        name: { type: "string" },
        notes: { type: "string" },
        completed: { type: "boolean" },
        due_on: { type: "string", description: "YYYY-MM-DD or null to clear" },
        assignee: { type: "string", description: "Assignee GID or null to unassign" },
        api_key: { type: "string" },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "get_asana_task",
    description: "Get full details of a single Asana task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_gid: { type: "string", description: "Task GID" },
        api_key: { type: "string" },
      },
      required: ["task_gid"],
    },
  },
  {
    name: "search_asana_tasks",
    description: "Search tasks by text within an Asana workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspace_gid: { type: "string", description: "Workspace GID" },
        text: { type: "string", description: "Search query" },
        completed: { type: "boolean" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["workspace_gid", "text"],
    },
  },

  // ── monday-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "list_monday_boards",
    description: "List boards in a Monday.com account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max boards to return (default 25)" },
        api_key: { type: "string", description: "Monday.com API token (or set MONDAY_API_KEY)" },
      },
    },
  },
  {
    name: "get_monday_board",
    description: "Get details of a specific Monday.com board including columns and groups.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID" },
        api_key: { type: "string" },
      },
      required: ["board_id"],
    },
  },
  {
    name: "list_monday_items",
    description: "List items (rows) in a Monday.com board.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID" },
        limit: { type: "number", description: "Max items (default 50)" },
        api_key: { type: "string" },
      },
      required: ["board_id"],
    },
  },
  {
    name: "create_monday_item",
    description: "Create a new item in a Monday.com board.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID" },
        item_name: { type: "string", description: "Item name" },
        group_id: { type: "string", description: "Group ID to add the item to" },
        column_values: { type: "object", description: "Column values as JSON object" },
        api_key: { type: "string" },
      },
      required: ["board_id", "item_name"],
    },
  },
  {
    name: "update_monday_item",
    description: "Update a column value on a Monday.com item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string" },
        item_id: { type: "string" },
        column_id: { type: "string", description: "Column ID to update" },
        value: { description: "New value (string or JSON)" },
        api_key: { type: "string" },
      },
      required: ["board_id", "item_id", "column_id", "value"],
    },
  },
  {
    name: "search_monday_items",
    description: "Search items by name in a Monday.com board.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string" },
        query: { type: "string", description: "Search text" },
        limit: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["board_id", "query"],
    },
  },

  // ── calendly-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "get_calendly_user",
    description: "Get the authenticated Calendly user profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "Calendly Personal Access Token (or set CALENDLY_API_KEY)" },
      },
    },
  },
  {
    name: "list_calendly_event_types",
    description: "List event types for the authenticated Calendly user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_uri: { type: "string", description: "User URI (auto-resolved if omitted)" },
        active: { type: "boolean", description: "Filter to active event types only" },
        count: { type: "number" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "list_calendly_events",
    description: "List scheduled events for the authenticated Calendly user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_uri: { type: "string", description: "User URI (auto-resolved if omitted)" },
        status: { type: "string", description: "active or canceled" },
        min_start_time: { type: "string", description: "ISO 8601 datetime" },
        max_start_time: { type: "string", description: "ISO 8601 datetime" },
        count: { type: "number" },
        sort: { type: "string", description: "e.g. start_time:asc" },
        api_key: { type: "string" },
      },
    },
  },
  {
    name: "get_calendly_event",
    description: "Get details of a single Calendly scheduled event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_uuid: { type: "string", description: "Event UUID" },
        api_key: { type: "string" },
      },
      required: ["event_uuid"],
    },
  },
  {
    name: "list_calendly_invitees",
    description: "List invitees for a Calendly scheduled event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        event_uuid: { type: "string", description: "Event UUID" },
        status: { type: "string", description: "active or canceled" },
        count: { type: "number" },
        api_key: { type: "string" },
      },
      required: ["event_uuid"],
    },
  },

  // ── pinterest-tool.ts ────────────────────────────────────────────────────────
  {
    name: "list_pinterest_boards",
    description: "List Pinterest boards for the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_size: { type: "number" },
        bookmark: { type: "string", description: "Pagination cursor" },
        privacy: { type: "string", description: "PUBLIC, PROTECTED, or SECRET" },
        access_token: { type: "string", description: "Pinterest access token (or set PINTEREST_ACCESS_TOKEN)" },
      },
    },
  },
  {
    name: "get_pinterest_board",
    description: "Get details of a specific Pinterest board.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID" },
        access_token: { type: "string" },
      },
      required: ["board_id"],
    },
  },
  {
    name: "list_pinterest_pins",
    description: "List pins on a Pinterest board.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID" },
        page_size: { type: "number" },
        bookmark: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["board_id"],
    },
  },
  {
    name: "create_pinterest_pin",
    description: "Create a new Pinterest pin from an image URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Board ID to pin to" },
        media_source_url: { type: "string", description: "Public image URL" },
        title: { type: "string" },
        description: { type: "string" },
        link: { type: "string", description: "Destination URL when pin is clicked" },
        board_section_id: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["board_id", "media_source_url"],
    },
  },
  {
    name: "search_pinterest_pins",
    description: "Search Pinterest pins by keyword.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        page_size: { type: "number" },
        bookmark: { type: "string" },
        access_token: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pinterest_user",
    description: "Get the authenticated Pinterest user account info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string" },
      },
    },
  },

  // ── tiktok-tool.ts ───────────────────────────────────────────────────────────
  {
    name: "get_tiktok_user",
    description: "Get the authenticated TikTok user profile (follower count, video count, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        access_token: { type: "string", description: "TikTok OAuth access token (or set TIKTOK_ACCESS_TOKEN)" },
      },
    },
  },
  {
    name: "list_tiktok_videos",
    description: "List videos for the authenticated TikTok user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max_count: { type: "number", description: "Max videos to return (default 20, max 20)" },
        cursor: { type: "number", description: "Pagination cursor" },
        access_token: { type: "string" },
      },
    },
  },
  {
    name: "get_tiktok_video",
    description: "Get details of a specific TikTok video by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        video_id: { type: "string", description: "TikTok video ID" },
        access_token: { type: "string" },
      },
      required: ["video_id"],
    },
  },

  // ── steam-tool.ts ────────────────────────────────────────────────────────────
  {
    name: "get_steam_player_summaries",
    description: "Get Steam player profile summaries for one or more Steam IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        steamids: { type: "string", description: "Comma-separated Steam64 IDs (up to 100)" },
        api_key: { type: "string", description: "Steam Web API key (or set STEAM_API_KEY)" },
      },
      required: ["steamids"],
    },
  },
  {
    name: "get_steam_owned_games",
    description: "Get games owned by a Steam user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        steamid: { type: "string", description: "Steam64 ID" },
        include_appinfo: { type: "boolean", description: "Include game names (default true)" },
        include_played_free_games: { type: "boolean" },
        api_key: { type: "string" },
      },
      required: ["steamid"],
    },
  },
  {
    name: "get_steam_achievements",
    description: "Get achievements for a Steam user in a specific game.",
    inputSchema: {
      type: "object" as const,
      properties: {
        steamid: { type: "string", description: "Steam64 ID" },
        appid: { type: "string", description: "Steam App ID of the game" },
        api_key: { type: "string" },
      },
      required: ["steamid", "appid"],
    },
  },
  {
    name: "get_steam_app_details",
    description: "Get store details for a Steam app (game info, price, platforms, Metacritic score).",
    inputSchema: {
      type: "object" as const,
      properties: {
        appid: { type: "string", description: "Steam App ID" },
        cc: { type: "string", description: "Country code for pricing (e.g. us, au)" },
        l: { type: "string", description: "Language code (e.g. english)" },
      },
      required: ["appid"],
    },
  },
  {
    name: "search_steam_store",
    description: "Search the Steam store for games by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        term: { type: "string", description: "Search term" },
        cc: { type: "string", description: "Country code for pricing" },
        l: { type: "string", description: "Language code" },
      },
      required: ["term"],
    },
  },

  // ── igdb-tool.ts ─────────────────────────────────────────────────────────────
  {
    name: "igdb_search_games",
    description: "Search the IGDB games database by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Game name to search for" },
        limit: { type: "number", description: "Max results (default 10, max 50)" },
        client_id: { type: "string", description: "Twitch/IGDB Client ID (or set IGDB_CLIENT_ID)" },
        client_secret: { type: "string", description: "Twitch/IGDB Client Secret (or set IGDB_CLIENT_SECRET)" },
      },
      required: ["query"],
    },
  },
  {
    name: "igdb_get_game",
    description: "Get full details of a game from IGDB by game ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_id: { type: "string", description: "IGDB game ID" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
      required: ["game_id"],
    },
  },
  {
    name: "igdb_list_platforms",
    description: "List gaming platforms from IGDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (default 30)" },
        offset: { type: "number" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },
  {
    name: "igdb_list_genres",
    description: "List all game genres from IGDB.",
    inputSchema: {
      type: "object" as const,
      properties: {
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },
  {
    name: "igdb_get_company",
    description: "Get a game company from IGDB by name or ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Company name to search for" },
        company_id: { type: "string", description: "IGDB company ID (takes precedence over name)" },
        client_id: { type: "string" },
        client_secret: { type: "string" },
      },
    },
  },

  // ── speedrun-tool.ts ─────────────────────────────────────────────────────────
  {
    name: "speedrun_search_games",
    description: "Search for games on Speedrun.com by name. No API key required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Game name to search" },
        max: { type: "number", description: "Max results" },
      },
      required: ["name"],
    },
  },
  {
    name: "speedrun_get_game",
    description: "Get details of a game on Speedrun.com including categories and levels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_id: { type: "string", description: "Speedrun.com game ID or abbreviation" },
      },
      required: ["game_id"],
    },
  },
  {
    name: "speedrun_get_leaderboard",
    description: "Get the leaderboard for a Speedrun.com game category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game_id: { type: "string", description: "Game ID" },
        category_id: { type: "string", description: "Category ID" },
        top: { type: "number", description: "Only return top N places" },
        platform: { type: "string" },
        emulators: { type: "boolean" },
        video_only: { type: "boolean" },
      },
      required: ["game_id", "category_id"],
    },
  },
  {
    name: "speedrun_list_runs",
    description: "List speedruns with optional filters for game, category, user, or status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        game: { type: "string", description: "Game ID" },
        category: { type: "string" },
        user: { type: "string", description: "User ID" },
        status: { type: "string", description: "new, verified, or rejected" },
        orderby: { type: "string", description: "date, submitted, status, game, category, level, platform, region, emulated, or weblink" },
        direction: { type: "string", description: "asc or desc" },
        max: { type: "number" },
      },
    },
  },
  {
    name: "speedrun_get_user",
    description: "Get a Speedrun.com user profile by ID or username.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "User ID or username" },
      },
      required: ["user_id"],
    },
  },

  // ── exchangerate-tool.ts ─────────────────────────────────────────────────────
  {
    name: "exchangerate_latest",
    description: "Get latest currency exchange rates for a base currency. Works without API key using the free tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        base: { type: "string", description: "Base currency code (default USD)" },
        api_key: { type: "string", description: "ExchangeRate-API key (or set EXCHANGERATE_API_KEY). Optional for latest rates." },
      },
    },
  },
  {
    name: "exchangerate_convert",
    description: "Convert an amount from one currency to another.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Source currency code (e.g. USD)" },
        to: { type: "string", description: "Target currency code (e.g. EUR)" },
        amount: { type: "number", description: "Amount to convert (default 1)" },
        api_key: { type: "string", description: "Optional for conversion (uses latest rates if omitted)" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "exchangerate_historical",
    description: "Get historical exchange rates for a specific date. Requires an API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        base: { type: "string", description: "Base currency code (default USD)" },
        year: { type: "string", description: "4-digit year" },
        month: { type: "string", description: "Month number (1-12)" },
        day: { type: "string", description: "Day number (1-31)" },
        api_key: { type: "string", description: "ExchangeRate-API key (required)" },
      },
      required: ["year", "month", "day"],
    },
  },
  {
    name: "exchangerate_codes",
    description: "List all supported currency codes and their names. Requires an API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        api_key: { type: "string", description: "ExchangeRate-API key (required)" },
      },
    },
  },

] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL_HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

export const ADDITIONAL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  // bgg-tool.ts
  bgg_search:           (args) => bggSearch(args),
  bgg_game_details:     (args) => bggGameDetails(args),
  bgg_user_collection:  (args) => bggUserCollection(args),
  bgg_top_games:        (args) => bggTopGames(args),
  bgg_game_reviews:     (args) => bggGameReviews(args),

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

  // gdelt-tool.ts
  gdelt_news_search:       (args) => gdeltNewsSearch(args),
  gdelt_tone_analysis:     (args) => gdeltToneAnalysis(args),
  gdelt_geo_events:        (args) => gdeltGeoEvents(args),
  gdelt_trending:          (args) => gdeltTrending(args),

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

  // line-tool.ts
  line_send_message:       (args) => lineSendMessage(args),
  line_send_flex_message:  (args) => lineSendFlexMessage(args),
  line_get_profile:        (args) => lineGetProfile(args),
  line_get_group_summary:  (args) => lineGetGroupSummary(args),
  line_reply_message:      (args) => lineReplyMessage(args),
  line_broadcast:          (args) => lineBroadcast(args),

  // figma-tool.ts
  figma_get_file:          (args) => figmaGetFile(args),
  figma_get_node:          (args) => figmaGetNode(args),
  figma_get_images:        (args) => figmaGetImages(args),
  figma_get_comments:      (args) => figmaGetComments(args),
  figma_post_comment:      (args) => figmaPostComment(args),
  figma_get_components:    (args) => figmaGetComponents(args),
  figma_get_team_projects: (args) => figmaGetTeamProjects(args),

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

  // ebay-tool.ts
  ebay_search:               (args) => ebaySearch(args),
  ebay_get_item:             (args) => ebayGetItem(args),
  ebay_get_item_by_legacy_id: (args) => ebayGetItemByLegacyId(args),
  ebay_get_categories:       (args) => ebayGetCategories(args),

  // etsy-tool.ts
  etsy_search_listings:      (args) => etsySearchListings(args),
  etsy_get_listing:          (args) => etsyGetListing(args),
  etsy_get_shop:             (args) => etsyGetShop(args),
  etsy_get_shop_listings:    (args) => etsyGetShopListings(args),
  etsy_search_shops:         (args) => etsySearchShops(args),

  // stripe-tool.ts
  stripe_customers:          (args) => stripeCustomers(args),
  stripe_charges:            (args) => stripeCharges(args),
  stripe_subscriptions:      (args) => stripeSubscriptions(args),
  stripe_invoices:           (args) => stripeInvoices(args),
  stripe_products:           (args) => stripeProducts(args),
  stripe_prices:             (args) => stripePrices(args),

  // paypal-tool.ts
  paypal_orders:             (args) => paypalOrders(args),
  paypal_invoices:           (args) => paypalInvoices(args),

  // square-tool.ts
  square_payments:           (args) => squarePayments(args),
  square_customers:          (args) => squareCustomers(args),
  square_catalog_list:       (args) => squareCatalogList(args),
  square_catalog_search:     (args) => squareCatalogSearch(args),

  // quickbooks-tool.ts
  quickbooks_customers:      (args) => quickbooksCustomers(args),
  quickbooks_invoices:       (args) => quickbooksInvoices(args),
  quickbooks_items:          (args) => quickbooksItems(args),
  quickbooks_payments:       (args) => quickbooksPayments(args),

  // plaid-tool.ts
  plaid_accounts:            (args) => plaidAccounts(args),
  plaid_transactions:        (args) => plaidTransactions(args),
  plaid_balances:            (args) => plaidBalances(args),
  plaid_identity:            (args) => plaidIdentity(args),
  plaid_link_token_create:   (args) => plaidLinkTokenCreate(args),

  // woocommerce-tool.ts
  woo_products:              (args) => wooProducts(args),
  woo_orders:                (args) => wooOrders(args),
  woo_customers:             (args) => wooCustomers(args),

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

  // github-tool.ts
  github_action:           (args) => githubAction(String(args.action ?? ""), args),

  // gitlab-tool.ts
  gitlab_action:           (args) => gitlabAction(String(args.action ?? ""), args),

  // clickup-tool.ts
  clickup_action:          (args) => clickupAction(String(args.action ?? ""), args),

  // linear-tool.ts
  linear_action:           (args) => linearAction(String(args.action ?? ""), args),

  // airtable-tool.ts
  airtable_action:         (args) => airtableAction(String(args.action ?? ""), args),

  // trello-tool.ts
  trello_action:           (args) => trelloAction(String(args.action ?? ""), args),

  // sentry-tool.ts
  sentry_action:           (args) => sentryAction(String(args.action ?? ""), args),

  // postman-tool.ts
  postman_action:          (args) => postmanAction(String(args.action ?? ""), args),

  // twilio-tool.ts
  twilio_send_sms:         (args) => twilioSendSms(args),
  twilio_list_messages:    (args) => twilioListMessages(args),
  twilio_get_message:      (args) => twilioGetMessage(args),
  twilio_make_call:        (args) => twilioMakeCall(args),
  twilio_list_calls:       (args) => twilioListCalls(args),
  twilio_send_verify:      (args) => twilioSendVerify(args),
  twilio_check_verify:     (args) => twilioCheckVerify(args),

  // pushover-tool.ts
  pushover_send_notification: (args) => pushoverSendNotification(args),
  pushover_get_receipt:       (args) => pushoverGetReceipt(args),
  pushover_cancel_emergency:  (args) => pushoverCancelEmergency(args),
  pushover_list_sounds:       (args) => pushoverListSounds(args),
  pushover_validate_user:     (args) => pushoverValidateUser(args),

  // whatsapp-tool.ts
  whatsapp_send_text:      (args) => whatsappSendText(args),
  whatsapp_send_template:  (args) => whatsappSendTemplate(args),
  whatsapp_send_media:     (args) => whatsappSendMedia(args),
  whatsapp_get_media:      (args) => whatsappGetMedia(args),
  whatsapp_upload_media:   (args) => whatsappUploadMedia(args),

  // youtube-tool.ts
  youtube_search:              (args) => youtubeSearch(args),
  youtube_get_video:           (args) => youtubeGetVideo(args),
  youtube_get_channel:         (args) => youtubeGetChannel(args),
  youtube_list_playlists:      (args) => youtubeListPlaylists(args),
  youtube_list_playlist_items: (args) => youtubeListPlaylistItems(args),
  youtube_get_captions:        (args) => youtubeGetCaptions(args),

  // spotify-tool.ts
  spotify_search:              (args) => spotifySearch(args),
  spotify_get_track:           (args) => spotifyGetTrack(args),
  spotify_get_album:           (args) => spotifyGetAlbum(args),
  spotify_get_artist:          (args) => spotifyGetArtist(args),
  spotify_get_playlist:        (args) => spotifyGetPlaylist(args),
  spotify_get_recommendations: (args) => spotifyGetRecommendations(args),
  spotify_get_audio_features:  (args) => spotifyGetAudioFeatures(args),

  // elevenlabs-tool.ts
  elevenlabs_list_voices:      (args) => elevenlabsListVoices(args),
  elevenlabs_get_voice:        (args) => elevenlabsGetVoice(args),
  elevenlabs_text_to_speech:   (args) => elevenlabsTextToSpeech(args),
  elevenlabs_get_models:       (args) => elevenlabsGetModels(args),
  elevenlabs_get_history:      (args) => elevenlabsGetHistory(args),

  // replicate-tool.ts
  replicate_list_models:       (args) => replicateListModels(args),
  replicate_get_model:         (args) => replicateGetModel(args),
  replicate_create_prediction: (args) => replicateCreatePrediction(args),
  replicate_get_prediction:    (args) => replicateGetPrediction(args),
  replicate_list_predictions:  (args) => replicateListPredictions(args),
  replicate_cancel_prediction: (args) => replicateCancelPrediction(args),

  // stability-tool.ts
  stability_text_to_image:     (args) => stabilityTextToImage(args),
  stability_image_to_image:    (args) => stabilityImageToImage(args),
  stability_upscale:           (args) => stabilityUpscale(args),
  stability_list_engines:      (args) => stabilityListEngines(args),

  // openai-tool.ts
  openai_chat_completion:      (args) => openaiChatCompletion(args),
  openai_create_embedding:     (args) => openaiCreateEmbedding(args),
  openai_generate_image:       (args) => openaiGenerateImage(args),
  openai_create_transcription: (args) => openaiCreateTranscription(args),
  openai_list_models:          (args) => openaiListModels(args),

  // anthropic-tool.ts
  anthropic_create_message:    (args) => anthropicCreateMessage(args),
  anthropic_list_models:       (args) => anthropicListModels(args),

  // asana-tool.ts
  list_asana_workspaces:   (args) => listAsanaWorkspaces(args),
  list_asana_projects:     (args) => listAsanaProjects(args),
  list_asana_tasks:        (args) => listAsanaTasks(args),
  create_asana_task:       (args) => createAsanaTask(args),
  update_asana_task:       (args) => updateAsanaTask(args),
  get_asana_task:          (args) => getAsanaTask(args),
  search_asana_tasks:      (args) => searchAsanaTasks(args),

  // monday-tool.ts
  list_monday_boards:      (args) => listMondayBoards(args),
  get_monday_board:        (args) => getMondayBoard(args),
  list_monday_items:       (args) => listMondayItems(args),
  create_monday_item:      (args) => createMondayItem(args),
  update_monday_item:      (args) => updateMondayItem(args),
  search_monday_items:     (args) => searchMondayItems(args),

  // calendly-tool.ts
  get_calendly_user:       (args) => getCalendlyUser(args),
  list_calendly_event_types:(args) => listCalendlyEventTypes(args),
  list_calendly_events:    (args) => listCalendlyEvents(args),
  get_calendly_event:      (args) => getCalendlyEvent(args),
  list_calendly_invitees:  (args) => listCalendlyInvitees(args),

  // pinterest-tool.ts
  list_pinterest_boards:   (args) => listPinterestBoards(args),
  get_pinterest_board:     (args) => getPinterestBoard(args),
  list_pinterest_pins:     (args) => listPinterestPins(args),
  create_pinterest_pin:    (args) => createPinterestPin(args),
  search_pinterest_pins:   (args) => searchPinterestPins(args),
  get_pinterest_user:      (args) => getPinterestUser(args),

  // tiktok-tool.ts
  get_tiktok_user:         (args) => getTiktokUser(args),
  list_tiktok_videos:      (args) => listTiktokVideos(args),
  get_tiktok_video:        (args) => getTiktokVideo(args),

  // steam-tool.ts
  get_steam_player_summaries:(args) => getSteamPlayerSummaries(args),
  get_steam_owned_games:   (args) => getSteamOwnedGames(args),
  get_steam_achievements:  (args) => getSteamAchievements(args),
  get_steam_app_details:   (args) => getSteamAppDetails(args),
  search_steam_store:      (args) => searchSteamStore(args),

  // igdb-tool.ts
  igdb_search_games:       (args) => igdbSearchGames(args),
  igdb_get_game:           (args) => igdbGetGame(args),
  igdb_list_platforms:     (args) => igdbListPlatforms(args),
  igdb_list_genres:        (args) => igdbListGenres(args),
  igdb_get_company:        (args) => igdbGetCompany(args),

  // speedrun-tool.ts
  speedrun_search_games:   (args) => speedrunSearchGames(args),
  speedrun_get_game:       (args) => speedrunGetGame(args),
  speedrun_get_leaderboard:(args) => speedrunGetLeaderboard(args),
  speedrun_list_runs:      (args) => speedrunListRuns(args),
  speedrun_get_user:       (args) => speedrunGetUser(args),

  // exchangerate-tool.ts
  exchangerate_latest:     (args) => exchangerateLatest(args),
  exchangerate_convert:    (args) => exchangerateConvert(args),
  exchangerate_historical: (args) => exchangerateHistorical(args),
  exchangerate_codes:      (args) => exchangerateCodes(args),
};
