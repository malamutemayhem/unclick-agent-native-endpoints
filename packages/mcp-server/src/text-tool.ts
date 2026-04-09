// Text analysis and transformation utilities.
// No API required -- pure computation.

// ─── analyse_text ─────────────────────────────────────────────────────────────

export function analyseText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  if (!text.trim()) return { error: "text is required." };

  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, "").length;
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const sentenceCount = (text.match(/[.!?]+/g) ?? []).length;
  const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || 1;

  // Reading time: average 200 wpm
  const readingTimeSec = Math.ceil((wordCount / 200) * 60);
  const readingTimeMin = (wordCount / 200).toFixed(1);

  // Most common words (ignore short stop words)
  const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "is", "it", "be", "as", "by", "i", "you", "he", "she", "we", "they", "this", "that", "was", "are", "have", "had", "not", "from", "his", "her", "its"]);
  const wordFreq: Record<string, number> = {};
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  for (const w of words) {
    if (!stopWords.has(w) && w.length > 2) {
      wordFreq[w] = (wordFreq[w] ?? 0) + 1;
    }
  }
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const lines = text.split("\n");

  return {
    character_count: charCount,
    character_count_no_spaces: charCountNoSpaces,
    word_count: wordCount,
    sentence_count: sentenceCount,
    paragraph_count: paragraphCount,
    line_count: lines.length,
    reading_time_minutes: Number(readingTimeMin),
    reading_time_seconds: readingTimeSec,
    average_words_per_sentence: sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 10) / 10 : null,
    top_words: topWords,
  };
}

// ─── transform_text ───────────────────────────────────────────────────────────

export function transformText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  const transform = String(args.transform ?? "").toLowerCase().replace(/-/g, "_");

  const transforms: Record<string, (s: string) => string> = {
    uppercase: (s) => s.toUpperCase(),
    lowercase: (s) => s.toLowerCase(),
    title_case: (s) =>
      s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
    snake_case: (s) =>
      s
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s\-]+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .toLowerCase(),
    camel_case: (s) => {
      const words = s.split(/[\s_\-]+/);
      return words[0].toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
    },
    kebab_case: (s) =>
      s
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-zA-Z0-9\-]/g, "")
        .toLowerCase(),
    reverse: (s) => s.split("").reverse().join(""),
    remove_spaces: (s) => s.replace(/\s/g, ""),
  };

  if (!transforms[transform]) {
    return {
      error: `transform "${transform}" is not supported.`,
      supported: Object.keys(transforms),
    };
  }

  return {
    original: text,
    transform,
    result: transforms[transform](text),
  };
}

// ─── extract_emails ───────────────────────────────────────────────────────────

export function extractEmails(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  if (!text.trim()) return { error: "text is required." };

  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) ?? [];
  const unique = [...new Set(matches)];

  return {
    count: unique.length,
    emails: unique,
    all_matches: matches,
  };
}

// ─── extract_urls ─────────────────────────────────────────────────────────────

export function extractUrls(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  if (!text.trim()) return { error: "text is required." };

  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const matches = text.match(urlRegex) ?? [];
  const unique = [...new Set(matches)];

  return {
    count: unique.length,
    urls: unique,
    all_matches: matches,
  };
}

// ─── extract_phone_numbers ────────────────────────────────────────────────────

export function extractPhoneNumbers(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  if (!text.trim()) return { error: "text is required." };

  // Matches AU mobile, landline, and international formats
  const phoneRegex = /(?:\+?61|0)(?:\s?\d){8,9}|\+?[1-9]\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g;
  const matches = text.match(phoneRegex) ?? [];
  const unique = [...new Set(matches.map((m) => m.trim()))];

  return {
    count: unique.length,
    phone_numbers: unique,
    note: "Pattern matches common AU and international formats. Some false positives are possible.",
  };
}

// ─── count_occurrences ────────────────────────────────────────────────────────

export function countOccurrences(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  const search = String(args.search_string ?? "");

  if (!text) return { error: "text is required." };
  if (!search) return { error: "search_string is required." };

  const positions: number[] = [];
  let idx = 0;
  while (true) {
    const found = text.indexOf(search, idx);
    if (found === -1) break;
    positions.push(found);
    idx = found + 1;
  }

  const caseSensitiveCount = positions.length;

  // Case-insensitive count
  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const ciPositions: number[] = [];
  let ci = 0;
  while (true) {
    const found = lowerText.indexOf(lowerSearch, ci);
    if (found === -1) break;
    ciPositions.push(found);
    ci = found + 1;
  }

  return {
    search_string: search,
    count_case_sensitive: caseSensitiveCount,
    count_case_insensitive: ciPositions.length,
    positions_case_sensitive: positions,
    positions_case_insensitive: ciPositions,
    text_length: text.length,
  };
}

// ─── truncate_text ────────────────────────────────────────────────────────────

export function truncateText(args: Record<string, unknown>): unknown {
  const text = String(args.text ?? "");
  const maxChars = Math.max(1, Number(args.max_chars ?? 100));
  const useEllipsis = args.ellipsis !== false && args.ellipsis !== "false";

  if (!text) return { error: "text is required." };
  if (isNaN(maxChars)) return { error: "max_chars must be a number." };

  const wasTruncated = text.length > maxChars;
  let result: string;

  if (!wasTruncated) {
    result = text;
  } else if (useEllipsis) {
    result = text.slice(0, Math.max(0, maxChars - 3)) + "...";
  } else {
    result = text.slice(0, maxChars);
  }

  return {
    original_length: text.length,
    max_chars: maxChars,
    truncated: wasTruncated,
    result,
    result_length: result.length,
  };
}
