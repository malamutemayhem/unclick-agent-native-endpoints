export type ScopePackSource = {
  scope_pack: Record<string, unknown>;
  source: "comment" | "field";
  comment_id?: string | null;
};

export type ScopePackCommentRow = {
  id?: string | null;
  text?: string | null;
  created_at?: string | null;
};

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function parseScopePackFromText(value: unknown): Record<string, unknown> | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;

  const label = String.raw`(?:scope[_ -]?pack|scopepack|runner[_ -]?scope|autonomous[_ -]?scope|coding[_ -]?room[_ -]?scope)`;
  const fencedPatterns = [
    new RegExp(String.raw`(?:^|\n)\s*${label}\s*:?\s*\r?\n\s*` + "```(?:json)?\\s*([\\s\\S]*?)```", "gi"),
    new RegExp(String.raw`(?:^|\n)\s*${label}\s*:\s*` + "```(?:json)?\\s*([\\s\\S]*?)```", "gi"),
    /<scope_pack>\s*([\s\S]*?)\s*<\/scope_pack>/gi,
  ];

  for (const pattern of fencedPatterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const parsed = parseJsonObject(match[1]);
      if (parsed) return parsed;
    }
  }

  const inlinePattern = new RegExp(String.raw`(?:^|\n)\s*${label}\s*:\s*(\{[^\r\n]*\})`, "gi");
  let match;
  while ((match = inlinePattern.exec(text))) {
    const parsed = parseJsonObject(match[1]);
    if (parsed) return parsed;
  }

  return null;
}

export function pickScopePackFromComments(
  comments: ScopePackCommentRow[] = [],
): ScopePackSource | null {
  const newestFirst = [...comments].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  for (const comment of newestFirst) {
    const scopePack = parseScopePackFromText(comment.text);
    if (scopePack) {
      return {
        scope_pack: scopePack,
        source: "comment",
        comment_id: comment.id ?? null,
      };
    }
  }

  return null;
}
