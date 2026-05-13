// Bridge between orchestrator-context.ts shaped data and the CommonSensePass
// verdict-only gate. Workers that already have access to todos + profiles
// (the orchestrator-context builder, the heartbeat seat, the watcher) can
// call `inspectOrchestratorActiveState` before emitting a healthy/quiet/
// no_work claim. The bridge does NOT mutate or publish anything; it returns
// the verdict and the caller decides what to do.
//
// This is the first worker-facing adoption surface for @unclick/commonsensepass.

import {
  commonsensepassCheck,
  type ClaimContext,
  type ClaimKind,
  type CommonSensePassResult,
  type TodoSnapshot,
  type TodoStatus,
} from "../../packages/commonsensepass/src/index.js";

export interface OrchestratorTodoShape {
  id: string;
  status: string;
  assigned_to_agent_id?: string | null;
}

export interface OrchestratorProfileShape {
  agent_id: string;
  last_seen_at?: string | null;
  created_at?: string | null;
}

export interface InspectActiveStateInput {
  /** The claim the worker is about to make. Defaults to "healthy". */
  claim?: Extract<ClaimKind, "healthy" | "quiet" | "no_work">;
  /** Orchestrator-shaped todos. */
  todos: OrchestratorTodoShape[];
  /** Orchestrator-shaped profiles, used to derive owner_last_seen_ms. */
  profiles: OrchestratorProfileShape[];
  /** Active_jobs count the worker is about to claim (the v9 formula output). */
  active_jobs: number;
  /** Current timestamp in ms; defaults to Date.now() if absent. */
  now_ms?: number;
}

const VALID_TODO_STATUSES: TodoStatus[] = [
  "actionable",
  "in_progress",
  "blocked",
  "queued",
  "done",
];

/**
 * Map orchestrator status strings (open, in_progress, done, dropped, ...) to
 * the smaller status set used by CommonSensePass:
 *   - "open"        -> "actionable" (worker can claim it)
 *   - "in_progress" -> "in_progress"
 *   - "blocked"     -> "blocked"
 *   - "done"        -> "done"
 *   - "dropped"     -> "done" (treated as off the queue, not actionable)
 *   - anything else -> "queued"
 */
function mapStatus(orchestratorStatus: string): TodoStatus {
  if (orchestratorStatus === "open") return "actionable";
  if (orchestratorStatus === "dropped") return "done";
  if ((VALID_TODO_STATUSES as string[]).includes(orchestratorStatus)) {
    return orchestratorStatus as TodoStatus;
  }
  return "queued";
}

/**
 * Build a TodoSnapshot[] from orchestrator-shaped rows and a profiles map,
 * deriving owner_last_seen_ms from the profile's last_seen_at (or created_at
 * as a conservative fallback).
 */
export function toTodoSnapshots(
  todos: OrchestratorTodoShape[],
  profiles: OrchestratorProfileShape[],
): TodoSnapshot[] {
  const ownerSeen = new Map<string, number | undefined>();
  for (const profile of profiles) {
    if (!profile.agent_id) continue;
    const iso = profile.last_seen_at ?? profile.created_at ?? null;
    const ms = iso ? Date.parse(iso) : NaN;
    ownerSeen.set(profile.agent_id, Number.isFinite(ms) ? ms : undefined);
  }

  return todos.map((todo) => {
    const ownerLastSeen =
      todo.assigned_to_agent_id != null
        ? ownerSeen.get(todo.assigned_to_agent_id)
        : undefined;
    const snapshot: TodoSnapshot = {
      id: todo.id,
      status: mapStatus(todo.status),
    };
    if (todo.assigned_to_agent_id != null) {
      snapshot.owner = todo.assigned_to_agent_id;
    }
    if (typeof ownerLastSeen === "number") {
      snapshot.owner_last_seen_ms = ownerLastSeen;
    }
    return snapshot;
  });
}

/**
 * Run R1 (active-state mismatch) against orchestrator-shaped data.
 *
 * The orchestrator-context builder produces a current_state_card that
 * implicitly claims `healthy` when active_jobs and queue depth both look
 * quiet. Workers that read that card and emit a public healthy/quiet/no_work
 * statement should call this first.
 *
 * Returns the CommonSensePass verdict. PASS = safe to emit the claim;
 * BLOCKER = stop, the active_jobs underreports or the queue has actionable
 * work; HOLD = supply more evidence.
 */
export function inspectOrchestratorActiveState(
  input: InspectActiveStateInput,
): CommonSensePassResult {
  const claim = input.claim ?? "healthy";
  const todos = toTodoSnapshots(input.todos, input.profiles);
  const context: ClaimContext = {
    now_ms: input.now_ms ?? Date.now(),
    todos,
    active_jobs: input.active_jobs,
  };
  return commonsensepassCheck({ claim, context });
}
