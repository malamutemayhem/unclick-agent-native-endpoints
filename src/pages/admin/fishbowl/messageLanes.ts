export type FishbowlMessageLaneTag = "heartbeat" | "event";

export interface FishbowlLaneMessage {
  tags: string[] | null;
}

const ROUTINE_LANE_TAGS = new Set<FishbowlMessageLaneTag>([
  "heartbeat",
  "event",
]);

export function hasMessageLaneTag(
  message: FishbowlLaneMessage,
  tag: FishbowlMessageLaneTag,
): boolean {
  return hasMessageTag(message, tag);
}

export function hasMessageTag(
  message: FishbowlLaneMessage,
  tag: string,
): boolean {
  return message.tags?.includes(tag) ?? false;
}

export function isHandoffMessage(message: FishbowlLaneMessage): boolean {
  return hasMessageTag(message, "handoff");
}

export function isRoutineLaneOnlyMessage(message: FishbowlLaneMessage): boolean {
  const tags = message.tags ?? [];
  return tags.length > 0 && tags.every((tag) => ROUTINE_LANE_TAGS.has(tag as FishbowlMessageLaneTag));
}

export function getLaneMessages<T extends FishbowlLaneMessage>(
  messages: T[],
  tag: FishbowlMessageLaneTag,
): T[] {
  return messages.filter((message) => hasMessageLaneTag(message, tag));
}

export function getMainFeedMessages<T extends FishbowlLaneMessage>(messages: T[]): T[] {
  return messages.filter((message) => !isRoutineLaneOnlyMessage(message));
}
