// Open Trivia Database integration.
// No authentication required - completely free and open.
// Base URL: https://opentdb.com/

const OPENTDB_BASE = "https://opentdb.com";

// Response codes from the API
const RESPONSE_CODES: Record<number, string> = {
  0: "Success",
  1: "No results - the database does not have enough questions for the requested parameters.",
  2: "Invalid parameter - one or more query parameters is invalid.",
  3: "Token not found.",
  4: "Token is empty - all available questions have been returned.",
  5: "Rate limit - too many requests. Please wait 5 seconds before trying again.",
};

interface TriviaQuestion {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface TriviaResponse {
  response_code: number;
  results: TriviaQuestion[];
}

interface CategoryResponse {
  trivia_categories: Array<{ id: number; name: string }>;
}

// ─── trivia_questions ─────────────────────────────────────────────────────────
// GET /api.php?amount={n}&category={id}&difficulty={easy|medium|hard}&type={multiple|boolean}

export async function triviaQuestions(args: Record<string, unknown>): Promise<unknown> {
  const amount = Math.min(50, Math.max(1, Number(args.amount ?? 10)));
  const params = new URLSearchParams({ amount: String(amount) });

  if (args.category) params.set("category", String(args.category));
  if (args.difficulty) {
    const diff = String(args.difficulty).toLowerCase();
    if (["easy", "medium", "hard"].includes(diff)) params.set("difficulty", diff);
  }
  if (args.type) {
    const type = String(args.type).toLowerCase();
    if (["multiple", "boolean"].includes(type)) params.set("type", type);
  }

  const res = await fetch(`${OPENTDB_BASE}/api.php?${params}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`Open Trivia DB HTTP ${res.status}`);

  const data = await res.json() as TriviaResponse;

  if (data.response_code !== 0) {
    return {
      error: RESPONSE_CODES[data.response_code] ?? `API error (code ${data.response_code}).`,
      response_code: data.response_code,
    };
  }

  return {
    count: data.results.length,
    questions: data.results.map((q) => ({
      category: q.category,
      type: q.type,
      difficulty: q.difficulty,
      question: decodeHtmlEntities(q.question),
      correct_answer: decodeHtmlEntities(q.correct_answer),
      incorrect_answers: q.incorrect_answers.map(decodeHtmlEntities),
      all_answers: shuffle([q.correct_answer, ...q.incorrect_answers]).map(decodeHtmlEntities),
    })),
  };
}

// ─── trivia_categories ────────────────────────────────────────────────────────
// GET /api_category.php

export async function triviaCategories(_args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${OPENTDB_BASE}/api_category.php`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`Open Trivia DB HTTP ${res.status}`);

  const data = await res.json() as CategoryResponse;

  return {
    count: data.trivia_categories.length,
    categories: data.trivia_categories,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
