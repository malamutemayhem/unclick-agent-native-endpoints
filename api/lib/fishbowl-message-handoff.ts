// Universal ACK Handoff planner for action-needed Fishbowl messages.

export const FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS = 600;

const ACTION_TAGS = new Set(["needs-doing", "blocker", "tripwire"]);
const PRE_DISPATCHED_AUTHORS = new Set(["github-action-wake-router"]);

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function isHumanProfile(profile: FishbowlMessageRecipientProfile): boolean {
  return (
    profile.userAgentHint === "admin-ui" ||
    profile.agentId.startsWith("human-") ||
    profile.agentId.startsWith("human_")
  );
}

export interface FishbowlMessageRecipientProfile {
  agentId: string;
  emoji: string | null | undefined;
  userAgentHint?: string | null | undefined;
}

export interface FishbowlMessageHandoffInput {
  messageId: string;
  text: string;
  tags: string[];
  recipients: string[];
  authorAgentId: string;
  recipientProfiles: FishbowlMessageRecipientProfile[];
}

export interface FishbowlMessageHandoffPlan {
  source: "fishbowl";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "message_handoff";
    handoff_message_id: string;
    summary: string;
    tags: string[];
    author_agent_id: string;
    ack_required: true;
  };
  leaseSeconds: number;
}

export interface FishbowlMessageHandoffDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: "fishbowl";
  target_agent_id: string;
  task_ref: string;
  status: "leased";
  lease_owner: string;
  lease_expires_at: string;
  payload: FishbowlMessageHandoffPlan["payload"];
  created_at: string;
  updated_at: string;
}

export function planFishbowlMessageHandoffs(
  input: FishbowlMessageHandoffInput,
): FishbowlMessageHandoffPlan[] {
  const normalizedAuthorAgentId = normalizeToken(input.authorAgentId);
  if (PRE_DISPATCHED_AUTHORS.has(normalizedAuthorAgentId)) return [];
  const normalizedTags = input.tags.map(normalizeToken).filter(Boolean);
  const tagSet = new Set(normalizedTags);
  if (tagSet.has("wake")) return [];
  const hasActionTag = normalizedTags.some((tag) => ACTION_TAGS.has(tag));
  if (!hasActionTag) return [];

  const authorProfile = input.recipientProfiles.find(
    (profile) =>
      !isHumanProfile(profile) &&
      normalizeToken(profile.agentId) === normalizedAuthorAgentId,
  );
  if (!authorProfile) return [];

  const recipients = input.recipients.map((recipient) => recipient.trim()).filter(Boolean);
  if (recipients.length !== 1 || recipients[0] === "all") return [];
  if (recipients[0].toLowerCase() === "all") return [];

  const summary = input.text.length > 200 ? `${input.text.slice(0, 197)}...` : input.text;
  const plans: FishbowlMessageHandoffPlan[] = [];
  const plannedTargets = new Set<string>();

  for (const recipient of recipients) {
    const matches = input.recipientProfiles.filter(
      (profile) =>
        !isHumanProfile(profile) &&
        (profile.agentId === recipient || profile.emoji === recipient),
    );
    if (matches.length !== 1) continue;

    const targetAgentId = matches[0].agentId;
    if (targetAgentId === input.authorAgentId || plannedTargets.has(targetAgentId)) continue;
    plannedTargets.add(targetAgentId);

    plans.push({
      source: "fishbowl",
      targetAgentId,
      taskRef: `fishbowl-message:${input.messageId}`,
      payload: {
        kind: "message_handoff",
        handoff_message_id: input.messageId,
        summary,
        tags: input.tags,
        author_agent_id: input.authorAgentId,
        ack_required: true,
      },
      leaseSeconds: FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS,
    });
  }

  return plans;
}

export function buildFishbowlMessageHandoffDispatchRow(params: {
  apiKeyHash: string;
  dispatchId: string;
  plan: FishbowlMessageHandoffPlan;
  now: Date;
}): FishbowlMessageHandoffDispatchRow {
  const nowIso = params.now.toISOString();
  return {
    api_key_hash: params.apiKeyHash,
    dispatch_id: params.dispatchId,
    source: params.plan.source,
    target_agent_id: params.plan.targetAgentId,
    task_ref: params.plan.taskRef,
    status: "leased",
    lease_owner: params.plan.targetAgentId,
    lease_expires_at: new Date(
      params.now.getTime() + params.plan.leaseSeconds * 1000,
    ).toISOString(),
    payload: params.plan.payload,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

