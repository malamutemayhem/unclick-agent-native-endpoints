// Random generation utilities.
// No API required -- pure computation using crypto-quality randomness where available.

function secureRandom(): number {
  // Use crypto if available, otherwise fall back to Math.random
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }
  return Math.random();
}

// ─── generate_uuid ────────────────────────────────────────────────────────────

export function generateUuid(_args: Record<string, unknown>): unknown {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  return { uuid, version: 4 };
}

// ─── generate_random_number ───────────────────────────────────────────────────

export function generateRandomNumber(args: Record<string, unknown>): unknown {
  const min = Number(args.min ?? 1);
  const max = Number(args.max ?? 100);
  const count = Math.min(100, Math.max(1, Number(args.count ?? 1)));

  if (isNaN(min) || isNaN(max)) return { error: "min and max must be numbers." };
  if (min > max) return { error: "min must be less than or equal to max." };

  const isInt = Number.isInteger(min) && Number.isInteger(max);
  const numbers = Array.from({ length: count }, () => {
    const n = min + secureRandom() * (max - min);
    return isInt ? Math.floor(min + secureRandom() * (max - min + 1)) : Math.round(n * 10000) / 10000;
  });

  // For integers, ensure range is correct
  const intNumbers = isInt
    ? Array.from({ length: count }, () => Math.floor(min + secureRandom() * (max - min + 1)))
    : numbers;

  return {
    min,
    max,
    count,
    type: isInt ? "integer" : "float",
    numbers: intNumbers,
    single: count === 1 ? intNumbers[0] : undefined,
  };
}

// ─── generate_random_string ───────────────────────────────────────────────────

const CHARSETS: Record<string, string> = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  numeric: "0123456789",
  hex: "0123456789abcdef",
  symbols: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

export function generateRandomString(args: Record<string, unknown>): unknown {
  const length = Math.min(1000, Math.max(1, Number(args.length ?? 16)));
  const charsetName = String(args.charset ?? "alphanumeric").toLowerCase();

  if (isNaN(length)) return { error: "length must be a number." };

  const charset = CHARSETS[charsetName];
  if (!charset) {
    return {
      error: `charset "${charsetName}" not supported.`,
      supported: Object.keys(CHARSETS),
    };
  }

  const result = Array.from({ length }, () => charset[Math.floor(secureRandom() * charset.length)]).join("");

  return {
    length,
    charset: charsetName,
    result,
  };
}

// ─── pick_random_from_list ────────────────────────────────────────────────────

export function pickRandomFromList(args: Record<string, unknown>): unknown {
  const items = args.items;
  if (!Array.isArray(items)) return { error: "items must be an array." };
  if (items.length === 0) return { error: "items array is empty." };

  const count = Math.min(items.length, Math.max(1, Number(args.count ?? 1)));

  // Fisher-Yates partial shuffle to pick without replacement
  const arr = [...items];
  for (let i = arr.length - 1; i > arr.length - 1 - count; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const picked = arr.slice(arr.length - count);

  return {
    total_items: items.length,
    count_requested: count,
    picked,
    single: count === 1 ? picked[0] : undefined,
  };
}

// ─── flip_coin ────────────────────────────────────────────────────────────────

export function flipCoin(args: Record<string, unknown>): unknown {
  const count = Math.min(1000, Math.max(1, Number(args.count ?? 1)));

  const results = Array.from({ length: count }, () => (secureRandom() < 0.5 ? "heads" : "tails"));
  const headsCount = results.filter((r) => r === "heads").length;
  const tailsCount = count - headsCount;

  return {
    count,
    result: count === 1 ? results[0] : undefined,
    results: count > 1 ? results : undefined,
    heads: headsCount,
    tails: tailsCount,
    heads_percent: Math.round((headsCount / count) * 1000) / 10,
    tails_percent: Math.round((tailsCount / count) * 1000) / 10,
  };
}

// ─── roll_dice ────────────────────────────────────────────────────────────────

export function rollDice(args: Record<string, unknown>): unknown {
  const sidesRaw = Number(args.sides ?? 6);
  const count = Math.min(20, Math.max(1, Number(args.count ?? 1)));
  const validSides = [4, 6, 8, 10, 12, 20, 100];

  if (!validSides.includes(sidesRaw)) {
    return { error: `sides must be one of: ${validSides.join(", ")}.` };
  }

  const rolls = Array.from({ length: count }, () => Math.floor(secureRandom() * sidesRaw) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);

  return {
    dice: `${count}d${sidesRaw}`,
    sides: sidesRaw,
    count,
    rolls,
    total,
    average: Math.round((total / count) * 100) / 100,
    min_possible: count,
    max_possible: count * sidesRaw,
  };
}

// ─── shuffle_list ─────────────────────────────────────────────────────────────

export function shuffleList(args: Record<string, unknown>): unknown {
  const items = args.items;
  if (!Array.isArray(items)) return { error: "items must be an array." };
  if (items.length === 0) return { original: [], shuffled: [] };

  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return {
    original_length: items.length,
    shuffled: arr,
  };
}

// ─── generate_lorem_ipsum ─────────────────────────────────────────────────────

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud", "exercitation",
  "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat",
  "duis", "aute", "irure", "in", "reprehenderit", "voluptate", "velit", "esse",
  "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat",
  "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt",
  "mollit", "anim", "id", "est", "laborum", "perspiciatis", "unde", "omnis",
  "iste", "natus", "error", "voluptatem", "accusantium", "doloremque", "laudantium",
  "totam", "rem", "aperiam", "eaque", "ipsa", "quae", "ab", "illo", "inventore",
  "veritatis", "quasi", "architecto", "beatae", "vitae", "dicta", "explicabo",
];

export function generateLoremIpsum(args: Record<string, unknown>): unknown {
  const paragraphs = Math.min(10, Math.max(1, Number(args.paragraphs ?? 1)));
  const sentencesPerParagraph = Math.min(10, Math.max(2, Number(args.sentences_per_paragraph ?? 5)));

  const rWord = () => LOREM_WORDS[Math.floor(secureRandom() * LOREM_WORDS.length)];
  const rSentence = () => {
    const wordCount = 8 + Math.floor(secureRandom() * 12);
    const words = Array.from({ length: wordCount }, rWord);
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(" ") + ".";
  };

  const result = Array.from({ length: paragraphs }, () =>
    Array.from({ length: sentencesPerParagraph }, rSentence).join(" ")
  );

  // First paragraph always starts with the classic opener
  result[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
    Array.from({ length: sentencesPerParagraph - 1 }, rSentence).join(" ");

  return {
    paragraphs,
    sentences_per_paragraph: sentencesPerParagraph,
    text: result.join("\n\n"),
    paragraph_array: result,
    word_count: result.join(" ").split(/\s+/).length,
  };
}
