export interface FishbowlJobPipelineTodo {
  title?: unknown;
  description?: unknown;
  status?: unknown;
}

export interface FishbowlJobPipelineState {
  pipeline_stage_count: number;
  pipeline_progress: number;
  pipeline_source: string;
  pipeline_evidence: string[];
}

export type FishbowlJobPipelineComment =
  | string
  | {
      text?: unknown;
      created_at?: unknown;
    };

const stageRank = {
  brief: 1,
  build: 2,
  proof: 3,
  review: 4,
  ship: 5,
} as const;

const stageProgress: Record<number, number> = {
  1: 10,
  2: 55,
  3: 70,
  4: 85,
  5: 100,
};

const PROOF_RESET_RE = /\b(reopened|re-opened|proof\s+reset|false\s+completion|partial\s+completion)\b/i;
const PROOF_MISSING_RE =
  /\b(no|missing|needs?|needed|waiting for|without|incomplete|stale)\s+(?:live\s+)?proof\b|\bproof\s+(?:missing|needed|incomplete|stale|not available)\b/i;

function positiveStageHit(text: string, positive: RegExp, negative?: RegExp): boolean {
  if (!positive.test(text)) return false;
  return negative ? !negative.test(text) : true;
}

function commentText(comment: FishbowlJobPipelineComment): string {
  if (typeof comment === "string") return comment;
  return typeof comment.text === "string" ? comment.text : "";
}

function buildSegments(todo: FishbowlJobPipelineTodo, comments: FishbowlJobPipelineComment[]): string[] {
  const commentSegments = [...comments].sort((a, b) => {
    if (typeof a === "string" || typeof b === "string") return 0;
    const aTime = typeof a.created_at === "string" ? Date.parse(a.created_at) : Number.NaN;
    const bTime = typeof b.created_at === "string" ? Date.parse(b.created_at) : Number.NaN;
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return aTime - bTime;
  });
  return [todo.title, todo.description, ...commentSegments.map(commentText)]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase());
}

export function inferFishbowlJobPipeline(
  todo: FishbowlJobPipelineTodo,
  comments: FishbowlJobPipelineComment[] = [],
): FishbowlJobPipelineState {
  const segments = buildSegments(todo, comments);
  const latestResetIndex = segments.reduce((latest, segment, index) => {
    return PROOF_RESET_RE.test(segment) || PROOF_MISSING_RE.test(segment) ? index : latest;
  }, -1);
  const latestProgressIndex = segments.reduce((latest, segment, index) => {
    return positiveStageHit(
      segment,
      /\b(implemented|built|build complete|patch applied|changes applied|pr\s*#?\d+|branch ready|commit(?:ted)?|ready for proof|build passed|checks? (?:passed|green)|tests? passed|proof (?:passed|complete|attached|submitted|recorded|current|clean)|verification (?:passed|complete)|ci passed|npm run build passed|qc pass|review(?:ed)?|reviewer pass|gatekeeper pass|safety pass|approved|ack:\s*pass|pass on #\d+|ready for review|pr\s*#?\d+\s+merged|merged\s+#?\d+|merged into main|deployed|published|shipped|live on production|production live)\b/i,
      /\b(blocker|hold|do not merge|do not lift)\b/i,
    )
      ? index
      : latest;
  }, -1);

  const status = String(todo.status ?? "");
  if (latestResetIndex >= 0 && latestResetIndex > latestProgressIndex) {
    const latestResetText = segments[latestResetIndex] ?? "";
    const resetHit = PROOF_RESET_RE.test(latestResetText);
    return {
      pipeline_stage_count: stageRank.brief,
      pipeline_progress: stageProgress[stageRank.brief],
      pipeline_source: resetHit ? "reopened: proof reset" : "proof: missing",
      pipeline_evidence: resetHit ? ["reopened", "proof_missing"] : ["proof_missing"],
    };
  }

  const activeSegments = latestResetIndex >= 0 ? segments.slice(latestResetIndex + 1) : segments;
  const corpus = activeSegments.join("\n");
  let activeCount = status === "done" ? stageRank.ship : status === "in_progress" ? stageRank.build : stageRank.brief;
  let source = status === "done" ? "status: done" : status === "in_progress" ? "status: active" : "status: open";
  const evidence: string[] = [];

  if (
    positiveStageHit(
      corpus,
      /\b(implemented|built|build complete|patch applied|changes applied|pr\s*#?\d+|branch ready|commit(?:ted)?|ready for proof)\b/i,
    )
  ) {
    activeCount = Math.max(activeCount, stageRank.build);
    evidence.push("build");
    source = "receipt: build";
  }

  if (
    positiveStageHit(
      corpus,
      /\b(build passed|checks? (?:passed|green)|tests? passed|proof (?:passed|complete|attached|submitted|recorded|current|clean)|verification (?:passed|complete)|ci passed|npm run build passed)\b/i,
      PROOF_MISSING_RE,
    )
  ) {
    activeCount = Math.max(activeCount, stageRank.proof);
    evidence.push("proof");
    source = "receipt: proof";
  }

  if (
    positiveStageHit(
      corpus,
      /\b(qc pass|review(?:ed)?|reviewer pass|gatekeeper pass|safety pass|approved|ack:\s*pass|pass on #\d+|ready for review)\b/i,
      /\b(no|missing|needs?|needed|waiting for|without|incomplete)\s+(?:qc|review|pass)\b|\b(blocker|hold|do not merge|do not lift)\b/i,
    )
  ) {
    activeCount = Math.max(activeCount, stageRank.review);
    evidence.push("review");
    source = "receipt: review";
  }

  if (
    positiveStageHit(
      corpus,
      /\b(pr\s*#?\d+\s+merged|merged\s+#?\d+|merged into main|deployed|published|shipped|live on production|production live)\b/i,
      /\b(not merged|unmerged|do not merge|blocked from merge|merge blocked)\b/i,
    )
  ) {
    activeCount = Math.max(activeCount, stageRank.ship);
    evidence.push("ship");
    source = "receipt: ship";
  }

  return {
    pipeline_stage_count: activeCount,
    pipeline_progress: stageProgress[activeCount] ?? stageProgress[stageRank.brief],
    pipeline_source: source,
    pipeline_evidence: evidence,
  };
}
