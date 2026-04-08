// Numbers API integration — interesting facts about numbers, dates, and years.
// No authentication required — completely free and open.
// Base URL: http://numbersapi.com/

const NUMBERS_BASE = "http://numbersapi.com";

const VALID_TYPES = ["trivia", "math", "date", "year"] as const;
type NumberType = typeof VALID_TYPES[number];

// ─── API helper ───────────────────────────────────────────────────────────────

interface NumbersResponse {
  text: string;
  number: number | string;
  found: boolean;
  type: string;
}

async function numbersFetch(path: string): Promise<NumbersResponse> {
  // Append ?json to get structured JSON instead of plain text
  const url = `${NUMBERS_BASE}${path}?json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`Numbers API HTTP ${res.status}`);
  return res.json() as Promise<NumbersResponse>;
}

// ─── number_fact ──────────────────────────────────────────────────────────────
// GET /{number}/{type}?json

export async function numberFact(args: Record<string, unknown>): Promise<unknown> {
  const number = String(args.number ?? "").trim();
  if (!number) return { error: "number is required." };

  const type: NumberType = VALID_TYPES.includes(String(args.type ?? "trivia") as NumberType)
    ? (String(args.type) as NumberType)
    : "trivia";

  const data = await numbersFetch(`/${encodeURIComponent(number)}/${type}`);

  return {
    number: data.number,
    type: data.type,
    fact: data.text,
    found: data.found,
  };
}

// ─── number_random ────────────────────────────────────────────────────────────
// GET /random/{type}?json

export async function numberRandom(args: Record<string, unknown>): Promise<unknown> {
  const type: NumberType = VALID_TYPES.includes(String(args.type ?? "trivia") as NumberType)
    ? (String(args.type) as NumberType)
    : "trivia";

  const data = await numbersFetch(`/random/${type}`);

  return {
    number: data.number,
    type: data.type,
    fact: data.text,
    found: data.found,
  };
}
