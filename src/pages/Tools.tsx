import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FadeIn from "../components/FadeIn";
import { useCanonical } from "../hooks/use-canonical";
import { useMetaTags } from "../hooks/useMetaTags";
import {
  Mail,
  TrendingUp,
  Shield,
  Share2,
  Cloud,
  Ticket,
  Music,
  Gamepad2,
  Trophy,
  Newspaper,
  ShoppingCart,
  BookOpen,
  UtensilsCrossed,
  MapPin,
  Headphones,
  Rocket,
  Terminal,
  Flag,
  Wrench,
  ArrowRight,
  ChevronRight,
  Home,
} from "lucide-react";

const CATEGORIES = [
  {
    id: "email",
    name: "Email",
    icon: Mail,
    count: 6,
    desc: "Send, search, read, and manage emails.",
    tools: ["email_send", "email_search", "email_read_inbox"],
    featured: true,
  },
  {
    id: "finance",
    name: "Finance",
    icon: TrendingUp,
    count: 20,
    desc: "Crypto prices, stock quotes, forex rates, and financial data.",
    tools: ["crypto_price", "stock_quote", "forex_convert"],
    featured: true,
  },
  {
    id: "security",
    name: "Security",
    icon: Shield,
    count: 10,
    desc: "Threat intel, CVE scanning, breach checks, and IP analysis.",
    tools: ["virustotal_scan_url", "hibp_check_account", "shodan_search"],
    featured: true,
  },
  {
    id: "social-media",
    name: "Social Media",
    icon: Share2,
    count: 15,
    desc: "Post, read, and manage across Reddit, Discord, Telegram, Mastodon, Bluesky.",
    tools: ["reddit_search", "discord_send", "telegram_send"],
  },
  {
    id: "weather",
    name: "Weather",
    icon: Cloud,
    count: 8,
    desc: "Current conditions, forecasts, surf, and tide data.",
    tools: ["weather_forecast", "tomorrow_realtime", "willyweather_surf"],
  },
  {
    id: "events",
    name: "Events & Tickets",
    icon: Ticket,
    count: 12,
    desc: "Find events on Ticketmaster, SeatGeek, Eventbrite, Bandsintown.",
    tools: ["tm_search_events", "seatgeek_search_events", "eventbrite_search_events"],
  },
  {
    id: "music",
    name: "Music",
    icon: Music,
    count: 15,
    desc: "Discover music across Deezer, Last.fm, Genius, MusicBrainz, Discogs.",
    tools: ["deezer_search", "genius_search", "lastfm_chart_top_tracks"],
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: Gamepad2,
    count: 15,
    desc: "Game stats, reviews, and data from RAWG, BGG, Riot, Bungie.",
    tools: ["rawg_search_games", "bgg_search", "riot_summoner"],
  },
  {
    id: "sports",
    name: "Sports",
    icon: Trophy,
    count: 20,
    desc: "Live scores, F1 data, fantasy football, esports.",
    tools: ["espn_nfl_scores", "f1_drivers", "fpl_player"],
  },
  {
    id: "news",
    name: "News",
    icon: Newspaper,
    count: 8,
    desc: "Multi-source headlines from NewsAPI, The Guardian, Hacker News.",
    tools: ["news_top_headlines", "guardian_search_articles", "hn_top_stories"],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: ShoppingCart,
    count: 8,
    desc: "Amazon search, Shopify store management.",
    tools: ["amazon_search", "shopify_products"],
  },
  {
    id: "books",
    name: "Books & Libraries",
    icon: BookOpen,
    count: 6,
    desc: "Search OpenLibrary, Trove, and discover trending books.",
    tools: ["openlibrary_search", "trove_search"],
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: UtensilsCrossed,
    count: 10,
    desc: "Recipe search, nutrition data, beer ratings.",
    tools: ["meal_search", "food_search", "untappd_search_beer"],
  },
  {
    id: "location",
    name: "Location & Places",
    icon: MapPin,
    count: 8,
    desc: "Find places, read reviews, get recommendations.",
    tools: ["yelp_search_businesses", "foursquare_search_places"],
  },
  {
    id: "podcasts",
    name: "Podcasts",
    icon: Headphones,
    count: 6,
    desc: "Search, discover, and get episode details.",
    tools: ["podcast_search", "podcast_trending"],
  },
  {
    id: "space",
    name: "Space",
    icon: Rocket,
    count: 4,
    desc: "NASA APOD, Mars photos, asteroid tracking, Earth imagery.",
    tools: ["nasa_apod", "nasa_mars_photos"],
  },
  {
    id: "dev",
    name: "Dev & Infra",
    icon: Terminal,
    count: 8,
    desc: "GitHub, Vercel, Cloudflare - manage repos, deployments, and infrastructure.",
    tools: ["github_list_repos", "vercel_list_projects"],
  },
  {
    id: "australia",
    name: "Australian Services",
    icon: Flag,
    count: 10,
    desc: "Amber Electric, AusPost, PTV, Domain, The Lott, Sendle.",
    tools: ["amber_current_price", "auspost_track_parcel", "ptv_departures"],
    featured: true,
  },
  {
    id: "smarthome",
    name: "Smart Home",
    icon: Home,
    count: 87,
    desc: "Home Assistant control - lights, locks, thermostats, cameras, automations, and 2,000+ device integrations.",
    tools: ["control_device", "get_entity_state", "trigger_automation"],
    featured: true,
  },
  {
    id: "utilities",
    name: "Utilities",
    icon: Wrench,
    count: 15,
    desc: "Text processing, unit conversion, calculations, random generation, datetime.",
    tools: ["text_analyse", "convert_weight", "calc_mortgage"],
  },
];

const EMAIL_TOOLS = [
  { name: "email_send", desc: "Send emails via Gmail/IMAP" },
  { name: "email_search", desc: "Search emails in inbox" },
  { name: "email_read_inbox", desc: "Read emails from inbox" },
  { name: "email_get", desc: "Get specific email by UID" },
  { name: "email_mark_read", desc: "Mark email as read" },
  { name: "email_delete", desc: "Delete email by UID" },
];

const FINANCE_TOOLS = [
  { name: "crypto_price", desc: "Get cryptocurrency prices from CoinGecko" },
  { name: "stock_quote", desc: "Get real-time stock quotes from Alpha Vantage" },
  { name: "forex_convert", desc: "Convert currencies using Open Exchange Rates" },
  { name: "crypto_coin", desc: "Get detailed crypto info from CoinGecko" },
  { name: "stock_daily", desc: "Get daily stock price history" },
  { name: "crypto_trending", desc: "Get trending cryptocurrencies" },
];

const SECURITY_TOOLS = [
  { name: "virustotal_scan_url", desc: "Submit URL for scanning on VirusTotal" },
  { name: "hibp_check_account", desc: "Check if email account in data breach" },
  { name: "shodan_search", desc: "Search Shodan for internet-connected devices" },
  { name: "virustotal_scan_domain", desc: "Get VirusTotal report for domain" },
  { name: "hibp_check_password", desc: "Check if password in data breach" },
  { name: "shodan_host_info", desc: "Get Shodan information for IP address" },
];

const AUSTRALIA_TOOLS = [
  { name: "amber_current_price", desc: "Get current electricity price" },
  { name: "auspost_track_parcel", desc: "Track Australia Post parcel" },
  { name: "ptv_departures", desc: "Get PTV departures for a stop" },
  { name: "domain_search_listings", desc: "Search Australian property listings" },
  { name: "lott_results", desc: "Get Australian lottery results" },
  { name: "sendle_get_quote", desc: "Get shipping quote from Sendle" },
];

const Tools = () => {
  useCanonical("/tools");
  useMetaTags({
    title: "UnClick Apps - Built-in tools and connected services",
    description: "Browse UnClick apps: built-in tools that work straight away, plus connected services that need login or API keys.",
    ogTitle: "UnClick Apps - Built-in tools and connected services",
    ogDescription: "Browse built-in apps and connected services for AI agents.",
    ogUrl: "https://unclick.world/tools",
  });

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 animated-grid opacity-40" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <FadeIn>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-xs font-medium text-primary">Apps</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Apps your AI can use.{" "}
              <span className="text-primary">One command.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="mt-4 text-lg text-body max-w-xl mx-auto leading-relaxed">
              Built-in apps work straight away. Connected apps use Passport when they need login,
              API keys, or extra permission.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/#install"
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started Free
              </Link>
              <a
                href="#categories"
                className="rounded-lg border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
                onClick={(e) => { e.preventDefault(); document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" }); }}
              >
                View Docs
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Category Grid */}
      <section id="categories" className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              All categories
            </h2>
            <p className="mt-3 text-center text-body max-w-xl mx-auto">
              Categories, built-in options, connected services, and more.
            </p>
          </FadeIn>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat, i) => (
              <FadeIn key={cat.id} delay={0.02 * i}>
                <a
                  href={`#${cat.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(cat.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group relative block h-full rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <cat.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      {cat.count}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-heading">{cat.name}</h3>
                  <p className="mt-1 text-xs text-body leading-relaxed">{cat.desc}</p>
                  <div className="mt-4 pt-4 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2">Example app actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {cat.tools.map((tool) => (
                        <span key={tool} className="text-xs bg-primary/5 text-primary px-2 py-1 rounded">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-primary group-hover:gap-2 transition-all text-xs font-medium">
                    Explore <ChevronRight className="h-3 w-3" />
                  </div>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Featured: Email */}
      <section id="email" className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Email Apps</h2>
            </div>
            <p className="text-body mt-2 max-w-2xl">
              AI-powered email management. Search, read, send, and organize - all through natural language.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="py-3 px-4 text-left font-semibold text-heading">Tool Name</th>
                    <th className="py-3 px-4 text-left font-medium text-body">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {EMAIL_TOOLS.map((tool, i) => (
                    <tr key={tool.name} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="py-3 px-4 font-mono text-xs text-primary">{tool.name}</td>
                      <td className="py-3 px-4 text-xs text-body">{tool.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Featured: Finance */}
      <section id="finance" className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Finance Apps</h2>
            </div>
            <p className="text-body mt-2 max-w-2xl">
              Unified financial data. Crypto, stocks, and forex in one interface.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="py-3 px-4 text-left font-semibold text-heading">Tool Name</th>
                    <th className="py-3 px-4 text-left font-medium text-body">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {FINANCE_TOOLS.map((tool, i) => (
                    <tr key={tool.name} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="py-3 px-4 font-mono text-xs text-primary">{tool.name}</td>
                      <td className="py-3 px-4 text-xs text-body">{tool.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Featured: Security */}
      <section id="security" className="px-6 py-16 bg-card/30">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Security Apps</h2>
            </div>
            <p className="text-body mt-2 max-w-2xl">
              Threat intelligence at your fingertips. Scan URLs, check breaches, monitor CVEs.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="py-3 px-4 text-left font-semibold text-heading">Tool Name</th>
                    <th className="py-3 px-4 text-left font-medium text-body">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {SECURITY_TOOLS.map((tool, i) => (
                    <tr key={tool.name} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="py-3 px-4 font-mono text-xs text-primary">{tool.name}</td>
                      <td className="py-3 px-4 text-xs text-body">{tool.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Featured: Australian Services */}
      <section id="australia" className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <Flag className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Australian Services</h2>
            </div>
            <p className="text-body mt-2 max-w-2xl">
              Built in Melbourne. Apps for Australian businesses and residents.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-8 rounded-xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="py-3 px-4 text-left font-semibold text-heading">Tool Name</th>
                    <th className="py-3 px-4 text-left font-medium text-body">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {AUSTRALIA_TOOLS.map((tool, i) => (
                    <tr key={tool.name} className={i % 2 === 0 ? "bg-card/40" : ""}>
                      <td className="py-3 px-4 font-mono text-xs text-primary">{tool.name}</td>
                      <td className="py-3 px-4 text-xs text-body">{tool.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Featured: Smart Home */}
      <section id="smarthome" className="px-6 py-16 bg-card/20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <Home className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Smart Home</h2>
            </div>
            <p className="text-body mt-2 max-w-2xl">
              Control your entire home through Home Assistant. 87 MCP tools across 23 categories, supporting 2,000+ device integrations.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Lights & Switches", desc: "All brands via HA" },
                { name: "Climate & HVAC", desc: "Nest, Ecobee, Daikin" },
                { name: "Locks & Security", desc: "Yale, August, Ring" },
                { name: "Cameras", desc: "Ring, Arlo, Reolink" },
                { name: "Speakers & Media", desc: "Sonos, Chromecast" },
                { name: "Sensors & Energy", desc: "Aqara, Shelly" },
                { name: "Automations", desc: "Create & trigger via AI" },
                { name: "Scenes & Scripts", desc: "Activate by name" },
              ].map((d) => (
                <div key={d.name} className="rounded-lg border border-border/40 bg-card/40 p-4">
                  <p className="text-sm font-semibold text-heading">{d.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-6 text-center">
              <Link
                to="/smarthome"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View Smart Home details <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Every tool. One server.{" "}
              <span className="text-primary">Zero friction.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/#install"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started Free
              </Link>
              <Link
                to="/docs"
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-heading backdrop-blur-sm transition-colors hover:bg-card/70"
              >
                View Docs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Tools;
