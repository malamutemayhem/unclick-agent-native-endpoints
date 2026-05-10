import type { ReactNode } from "react";

function markDirectMatches(mask: boolean[], lowerText: string, token: string) {
  let start = lowerText.indexOf(token);
  while (start >= 0) {
    for (let index = start; index < start + token.length; index += 1) {
      mask[index] = true;
    }
    start = lowerText.indexOf(token, start + 1);
  }
}

function markSubsequenceMatch(mask: boolean[], lowerText: string, token: string) {
  let tokenIndex = 0;
  const matchedIndexes: number[] = [];
  for (let index = 0; index < lowerText.length && tokenIndex < token.length; index += 1) {
    const char = lowerText[index];
    if (/\s/.test(char)) continue;
    if (char === token[tokenIndex]) {
      matchedIndexes.push(index);
      tokenIndex += 1;
    }
  }
  if (tokenIndex !== token.length) return;
  for (const index of matchedIndexes) {
    mask[index] = true;
  }
}

export function highlightSearchText(text: string, query: string): ReactNode {
  const trimmedQuery = query.toLowerCase().trim();
  if (!trimmedQuery) return text;

  const mask = Array.from({ length: text.length }, () => false);
  const lowerText = text.toLowerCase();
  const compactText = lowerText.replace(/[\s:_-]+/g, "");
  const tokens = trimmedQuery
    .split(/\s+/)
    .map((token) => token.replace(/[\s:_-]+/g, ""))
    .filter(Boolean);

  for (const token of tokens) {
    if (lowerText.includes(token)) {
      markDirectMatches(mask, lowerText, token);
    } else if (compactText.includes(token)) {
      markSubsequenceMatch(mask, lowerText, token);
    } else {
      markSubsequenceMatch(mask, lowerText, token);
    }
  }

  const parts: ReactNode[] = [];
  let index = 0;
  while (index < text.length) {
    const highlighted = mask[index];
    let end = index + 1;
    while (end < text.length && mask[end] === highlighted) {
      end += 1;
    }
    const value = text.slice(index, end);
    parts.push(
      highlighted ? (
        <mark key={index} className="rounded-[3px] bg-[#61C1C4]/15 px-0.5 font-semibold text-[#8EF5F8]">
          {value}
        </mark>
      ) : (
        <span key={index}>{value}</span>
      ),
    );
    index = end;
  }

  return parts;
}
