// Universal ACK Handoff planner for direct worker-to-worker Fishbowl posts.
//
// Only direct action-needed handoffs are wrapped:
// one known non-human worker recipient plus an action tag. Room chatter,
// human escalations, self-handoffs, and no-op posts stay silent.

export const FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS = 600;
const ACTION_TAGS = new Set(["needs-doing", "blocker", "tripwire"]);

export interface FishbowlRecipientProfile {
  agent_id: string;
  emoji: string | null;
  user_agent_hint: string | null;
}

export interface FishbowlMessageHandoffInput {
  messageId: string;
  text: string;
  tags: readonly string[] | null | undefined;
  recipients: readonly string[];
  authorAgentId: string;
  authorEmoji: string | null | undefined;
  recipientProfiles: readonly FishbowlRecipientProfile[];
}

export interface FishbowlMessageHandoffPlan {
  source: "fishbowl";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "fishbowl_worker_handoff";
    message_id: string;
    text_preview: string;
    recipients: string[];
    tags: string[];
    action_tags: string[];
    created_by_agent_id: string;
    author_emoji: string | null;
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

export function planFishbowlMessageHandoff(
  input: FishbowlMessageHandoffInput,
): FishbowlMessageHandoffPlan | null {
  const tags = [...(input.tags ?? [])];
  const actionTags = tags.filter((tag) => ACTION_TAGS.has(tag));
  if (actionTags.length === 0) return null;

  const authorProfile = input.recipientProfiles.find(
    (profile) => profile.agent_id === input.authorAgentId,
  );
  if (!authorProfile) return null;
  if (authorProfile.user_agent_hint === "admin-ui") return null;
  if (authorProfile.agent_id.startsWith("human-")) return null;

  const recipientTokens = input.recipients.map((recipient) => recipient.trim()).filter(Boolean);
  if (recipientTokens.length !== 1) return null;
  if (recipientTokens[0] === "all") return null;

  const targetProfile = input.recipientProfiles.find(
    (profile) => profile.agent_id === recipientTokens[0] || profile.emoji === recipientTokens[0],
  );
  if (!targetProfile) return null;
  if (targetProfile.user_agent_hint === "admin-ui") return null;
  if (targetProfile.agent_id.startsWith("human-")) return null;
  if (targetProfile.agent_id === input.authorAgentId) return null;

  return {
    source: "fishbowl",
    targetAgentId: targetProfile.agent_id,
    taskRef: input.messageId,
    payload: {
      kind: "fishbowl_worker_handoff",
      message_id: input.messageId,
      text_preview: compactPreview(input.text),
      recipients: recipientTokens,
      tags,
      action_tags: actionTags,
      created_by_agent_id: input.authorAgentId,
      author_emoji: input.authorEmoji ?? null,
      ack_required: true,
    },
    leaseSeconds: FISHBOWL_MESSAGE_HANDOFF_LEASE_SECONDS,
  };
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

function compactPreview(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}
