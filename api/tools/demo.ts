/**
 * UnClick Tools Demo - Vercel serverless function
 *
 * Route: GET /api/tools/demo?tool_name=<name>&test_query=<query>
 *
 * Zero-config demo endpoint. No account or API key required.
 * Rate limited to 5 calls per IP per day. Returns X-Demo-Calls-Remaining header.
 *
 * Supported tools:
 *   openmeteo    - Current weather for a city name
 *   numbers      - Interesting fact about a number
 *   trivia       - Random trivia question (optional category filter)
 *   hackernews   - Top Hacker News stories matching a search term
 *   restcountries - Info about a country by name
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const DEMO_LIMIT = 5;

// ---------------------------------------------------------------------------
// Tool implementations (all use free, keyless public APIs)
// ---------------------------------------------------------------------------

async function runOpenMeteo(query: string): Promise<unknown> {
  const city = query.trim() || "London";

  // Geocode the city name
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  if (!geoRes.ok) throw new Error("Geocoding request failed");
  const geoData = await geoRes.json();
  const place = geoData.results?.[0];
  if (!place) return { error: `City not found: ${city}` };

  // Fetch current weather
  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true&wind_speed_unit=mph`
  );
  if (!wxRes.ok) throw new Error("Weather request failed");
  const wxData = await wxRes.json();

  return {
    location: `${place.name}, ${place.country}`,
    latitude: place.latitude,
    longitude: place.longitude,
    weather: wxData.current_weather,
  };
}

async function runNumbers(query: string): Promise<unknown> {
  const num = parseInt(query.trim(), 10);
  const target = isNaN(num) ? "random" : String(num);

  const res = await fetch(`http://numbersapi.com/${target}?json`);
  if (!res.ok) throw new Error("Numbers API request failed");
  return res.json();
}

async function runTrivia(query: string): Promise<unknown> {
  // query can be a category name or left blank for random
  const categoryMap: Record<string, number> = {
    general: 9,
    books: 10,
    film: 11,
    music: 12,
    science: 17,
    computers: 18,
    math: 19,
    sports: 21,
    geography: 22,
    history: 23,
    art: 25,
    animals: 27,
  };

  const categoryKey = query.trim().toLowerCase();
  const categoryId = categoryMap[categoryKey];
  const url = categoryId
    ? `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`
    : `https://opentdb.com/api.php?amount=1&type=multiple`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Trivia API request failed");
  const data = await res.json();
  const question = data.results?.[0];
  if (!question) return { error: "No trivia question returned" };

  return {
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    correct_answer: question.correct_answer,
    incorrect_answers: question.incorrect_answers,
  };
}

async function runHackerNews(query: string): Promise<unknown> {
  const term = query.trim() || "AI";
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&hitsPerPage=5&tags=story`
  );
  if (!res.ok) throw new Error("Hacker News API request failed");
  const data = await res.json();

  return {
    query: term,
    hits: (data.hits ?? []).map((h: Record<string, unknown>) => ({
      title: h.title,
      url: h.url ?? null,
      author: h.author,
      points: h.points,
      num_comments: h.num_comments,
      created_at: h.created_at,
      story_url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    })),
  };
}

async function runRestCountries(query: string): Promise<unknown> {
  const name = query.trim() || "Canada";
  const res = await fetch(
    `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,population,region,subregion,languages,currencies,flags`
  );
  if (!res.ok) {
    if (res.status === 404) return { error: `Country not found: ${name}` };
    throw new Error("REST Countries API request failed");
  }
  const data = await res.json();
  return data[0] ?? { error: "No country data returned" };
}

const DEMO_TOOLS: Record<string, (query: string) => Promise<unknown>> = {
  openmeteo: runOpenMeteo,
  numbers: runNumbers,
  trivia: runTrivia,
  hackernews: runHackerNews,
  restcountries: runRestCountries,
};

// ---------------------------------------------------------------------------
// Rate limit helpers
// ---------------------------------------------------------------------------

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const tool_name = req.query.tool_name;
  const test_query = req.query.test_query;

  if (!tool_name || typeof tool_name !== "string") {
    return res.status(400).json({
      error: "tool_name is required",
      available_tools: Object.keys(DEMO_TOOLS),
    });
  }

  const runner = DEMO_TOOLS[tool_name.toLowerCase()];
  if (!runner) {
    return res.status(400).json({
      error: `Unknown tool: ${tool_name}`,
      available_tools: Object.keys(DEMO_TOOLS),
    });
  }

  // Rate limiting
  const rawIp =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const ipHash = hashIp(rawIp);
  const callDate = todayDate();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  let currentCount = 0;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: rateData } = await supabase
      .from("demo_rate_limits")
      .select("call_count")
      .eq("ip_hash", ipHash)
      .eq("call_date", callDate)
      .single();

    currentCount = rateData?.call_count ?? 0;

    if (currentCount >= DEMO_LIMIT) {
      res.setHeader("X-Demo-Calls-Remaining", "0");
      return res.status(429).json({
        error: "Demo limit reached. 5 free calls per day. Sign up for full access.",
        calls_remaining: 0,
      });
    }

    // Increment the counter (non-blocking, fire-and-forget)
    supabase
      .from("demo_rate_limits")
      .upsert(
        { ip_hash: ipHash, call_date: callDate, call_count: currentCount + 1 },
        { onConflict: "ip_hash,call_date" }
      )
      .then(({ error }) => {
        if (error) console.error("Rate limit upsert error:", error.message);
      });
  } else {
    console.warn("Supabase env vars missing - demo rate limiting disabled");
  }

  const remaining = Math.max(0, DEMO_LIMIT - (currentCount + 1));
  res.setHeader("X-Demo-Calls-Remaining", String(remaining));

  const query = typeof test_query === "string" ? test_query : "";

  try {
    const result = await runner(query);
    return res.status(200).json({ tool: tool_name, query, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Demo tool error [${tool_name}]:`, message);
    return res.status(502).json({ error: `Tool execution failed: ${message}` });
  }
}
