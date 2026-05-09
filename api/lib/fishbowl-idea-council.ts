// Universal ACK Handoff planner for Fishbowl Ideas Council participation.
//
// A newly proposed idea should invite a small worker quorum to comment/vote.
// The invite is action-needed enough to track with a 600-second ACK lease, but
// only targets AI worker profiles. Humans, the author, and missing profiles stay
// silent so Ideas does not become noisy.

export const FISHBOWL_IDEA_COUNCIL_LEASE_SECONDS = 600;
export const FISHBOWL_IDEA_COUNCIL_MAX_REVIEWERS = 2;

export interface FishbowlIdeaCouncilProfile {
  agentId: string;
  emoji?: string | null | undefined;
  displayName?: string | null | undefined;
  userAgentHint?: string | null | undefined;
  lastSeenAt?: string | null | undefined;
  currentStatusUpdatedAt?: string | null | undefined;
}

export interface FishbowlIdeaCouncilInput {
  ideaId: string;
  title: string;
  description?: string | null | undefined;
  createdByAgentId: string;
  profiles: FishbowlIdeaCouncilProfile[];
  maxReviewers?: number;
}

export interface FishbowlIdeaCouncilPlan {
  source: "fishbowl";
  targetAgentId: string;
  taskRef: string;
  payload: {
    kind: "idea_council_review";
    idea_id: string;
    title: string;
    summary: string;
    deep_link: string;
    created_by_agent_id: string;
    requested_action: "comment_or_vote";
    ack_required: true;
  };
  leaseSeconds: number;
}

export interface FishbowlIdeaCouncilDispatchRow {
  api_key_hash: string;
  dispatch_id: string;
  source: "fishbowl";
  target_agent_id: string;
  task_ref: string;
  status: "leased";
  lease_owner: string;
  lease_expires_at: string;
  payload: FishbowlIdeaCouncilPlan["payload"];
  created_at: string;
  updated_at: string;
}

function isHumanProfile(profile: FishbowlIdeaCouncilProfile): boolean {
  return (
    profile.userAgentHint === "admin-ui" ||
    profile.agentId.startsWith("human-") ||
    profile.agentId.startsWith("human_")
  );
}

function recencyMillis(profile: FishbowlIdeaCouncilProfile): number {
  const candidates = [profile.lastSeenAt, profile.currentStatusUpdatedAt]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function compactSummary(title: string, description: string | null | undefined): string {
  const source = (description ?? "").trim() || title;
  return source.length > 200 ? `${source.slice(0, 197)}...` : source;
}

export function planFishbowlIdeaCouncilHandoffs(
  input: FishbowlIdeaCouncilInput,
): FishbowlIdeaCouncilPlan[] {
  const maxReviewers = Math.max(
    0,
    Math.min(input.maxReviewers ?? FISHBOWL_IDEA_COUNCIL_MAX_REVIEWERS, 5),
  );
  if (maxReviewers === 0) return [];

  const plannedTargets = new Set<string>();
  const eligibleProfiles = input.profiles
    .filter((profile) => profile.agentId.trim())
    .filter((profile) => profile.agentId !== input.createdByAgentId)
    .filter((profile) => !isHumanProfile(profile))
    .sort((a, b) => recencyMillis(b) - recencyMillis(a));

  const summary = compactSummary(input.title, input.description);
  const plans: FishbowlIdeaCouncilPlan[] = [];

  for (const profile of eligibleProfiles) {
    if (plannedTargets.has(profile.agentId)) continue;
    plannedTargets.add(profile.agentId);
    plans.push({
      source: "fishbowl",
      targetAgentId: profile.agentId,
      taskRef: `fishbowl-idea:${input.ideaId}`,
      payload: {
        kind: "idea_council_review",
        idea_id: input.ideaId,
        title: input.title,
        summary,
        deep_link: `/admin/boardroom#idea-${input.ideaId}`,
        created_by_agent_id: input.createdByAgentId,
        requested_action: "comment_or_vote",
        ack_required: true,
      },
      leaseSeconds: FISHBOWL_IDEA_COUNCIL_LEASE_SECONDS,
    });

    if (plans.length >= maxReviewers) break;
  }

  return plans;
}

export function buildFishbowlIdeaCouncilDispatchRow(params: {
  apiKeyHash: string;
  dispatchId: string;
  plan: FishbowlIdeaCouncilPlan;
  now: Date;
}): FishbowlIdeaCouncilDispatchRow {
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
