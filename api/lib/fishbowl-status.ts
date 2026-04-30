const MAX_STATUS_LENGTH = 200;

export function statusFromFishbowlPost(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line.length > 0);

  if (!firstLine) return null;
  if (firstLine.length <= MAX_STATUS_LENGTH) return firstLine;
  return `${firstLine.slice(0, MAX_STATUS_LENGTH - 3)}...`;
}
