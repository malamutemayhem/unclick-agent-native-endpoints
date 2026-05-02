// src/pages/admin/fishbowl/Settings.tsx
//
// Fishbowl heartbeat Settings panel - collapsible, dark theme, localStorage prefs.
// Slot: after <NowPlayingStrip /> in Fishbowl.tsx main component.
// Import: import FishbowlSettings from "./fishbowl/Settings";
// Usage: <FishbowlSettings profiles={profiles} />
//
// This is frontend-only MVP. Prefs stored in localStorage.
// Phase 2: persist to mc_fishbowl_settings table via API.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { findDuplicateProfileAgentIds } from "./clusterProfiles";

/* -- types -- */
interface FishbowlProfile {
  agent_id: string;
  emoji: string;
  display_name: string | null;
  user_agent_hint: string | null;
  created_at: string;
  last_seen_at: string | null;
  current_status: string | null;
  current_status_updated_at: string | null;
  next_checkin_at: string | null;
}

interface HeartbeatPrefs {
  pulseIntervalMin: 15 | 30 | 60;
  staleThresholdMin: 5 | 10 | 15 | 30;
  hideIdleAgents: boolean;
  tagFilters: string[];           // empty = show all
  mutedAgentIds: string[];        // agent_ids to hide from feed
  eventsBotEnabled: boolean;      // placeholder for future events bot
}

const DEFAULT_PREFS: HeartbeatPrefs = {
  pulseIntervalMin: 15,
  staleThresholdMin: 5,
  hideIdleAgents: false,
  tagFilters: [],
  mutedAgentIds: [],
  eventsBotEnabled: false,
};

const STORAGE_KEY = "unclick.fishbowl.heartbeat.settings";
const CANONICAL_TAGS = [
  "heartbeat", "qc", "pr", "decision", "question",
  "answer", "handoff", "blocker", "done", "fyi",
];

/* -- helpers -- */
function loadPrefs(): HeartbeatPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: HeartbeatPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable; ignore.
  }
}

/* -- component -- */
export default function FishbowlSettings({
  profiles,
}: {
  profiles: FishbowlProfile[];
}) {
  const [collapsed, setCollapsed] = useState(true); // default-collapsed
  const [prefs, setPrefs] = useState<HeartbeatPrefs>(loadPrefs);

  // Persist on change
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const update = useCallback(
    <K extends keyof HeartbeatPrefs>(key: K, value: HeartbeatPrefs[K]) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleTag = useCallback((tag: string) => {
    setPrefs((prev) => {
      const next = prev.tagFilters.includes(tag)
        ? prev.tagFilters.filter((t) => t !== tag)
        : [...prev.tagFilters, tag];
      return { ...prev, tagFilters: next };
    });
  }, []);

  const toggleMute = useCallback((agentId: string) => {
    setPrefs((prev) => {
      const next = prev.mutedAgentIds.includes(agentId)
        ? prev.mutedAgentIds.filter((id) => id !== agentId)
        : [...prev.mutedAgentIds, agentId];
      return { ...prev, mutedAgentIds: next };
    });
  }, []);

  // Only show non-human agents in mute list
  const agentProfiles = useMemo(
    () => profiles.filter((p) => !p.agent_id.startsWith("human-")),
    [profiles],
  );
  const duplicateAgentIds = useMemo(
    () => findDuplicateProfileAgentIds(agentProfiles),
    [agentProfiles],
  );

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#ccc]">
          <SettingsIcon className="h-3.5 w-3.5 text-[#888]" />
          <span>Heartbeat Settings</span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-[#555]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#555]" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-5 border-t border-white/[0.06] px-4 py-4">
          {/* -- Pulse interval -- */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#888]">
              Pulse interval
            </legend>
            <div className="flex gap-2">
              {([15, 30, 60] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update("pulseIntervalMin", v)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                    prefs.pulseIntervalMin === v
                      ? "border-[#E2B93B]/40 bg-[#E2B93B]/15 text-[#E2B93B]"
                      : "border-white/[0.08] bg-white/[0.03] text-[#888] hover:text-[#ccc]"
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
          </fieldset>

          {/* -- Stale threshold -- */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#888]">
              Stale threshold
            </legend>
            <div className="flex gap-2">
              {([5, 10, 15, 30] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update("staleThresholdMin", v)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                    prefs.staleThresholdMin === v
                      ? "border-[#E2B93B]/40 bg-[#E2B93B]/15 text-[#E2B93B]"
                      : "border-white/[0.08] bg-white/[0.03] text-[#888] hover:text-[#ccc]"
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
          </fieldset>

          {/* -- Toggles row -- */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#888]">
              <input
                type="checkbox"
                checked={prefs.hideIdleAgents}
                onChange={(e) => update("hideIdleAgents", e.target.checked)}
                className="accent-[#E2B93B]"
              />
              Hide idle agents on strip
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#888]">
              <input
                type="checkbox"
                checked={prefs.eventsBotEnabled}
                onChange={(e) => update("eventsBotEnabled", e.target.checked)}
                className="accent-[#E2B93B]"
              />
              Events bot
              <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] uppercase text-[#555]">
                soon
              </span>
            </label>
          </div>

          {/* -- Tag filters -- */}
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#888]">
              Tag filters
              {prefs.tagFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => update("tagFilters", [])}
                  className="ml-2 text-[10px] text-[#E2B93B] hover:underline"
                >
                  clear
                </button>
              )}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {CANONICAL_TAGS.map((tag) => {
                const active = prefs.tagFilters.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? "border-[#E2B93B]/40 bg-[#E2B93B]/15 text-[#E2B93B]"
                        : "border-white/[0.08] bg-white/[0.03] text-[#666] hover:text-[#888]"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-[#555]">
              {prefs.tagFilters.length === 0
                ? "Showing all tags"
                : `Showing: ${prefs.tagFilters.join(", ")}`}
            </p>
          </fieldset>

          {/* -- Mute per agent -- */}
          {agentProfiles.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#888]">
                Mute agents
              </legend>
              <div className="flex flex-wrap gap-2">
                {agentProfiles.map((p) => {
                  const muted = prefs.mutedAgentIds.includes(p.agent_id);
                  const duplicate = duplicateAgentIds.has(p.agent_id);
                  return (
                    <button
                      key={p.agent_id}
                      type="button"
                      onClick={() => toggleMute(p.agent_id)}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                        muted
                          ? "border-red-400/30 bg-red-400/10 text-red-300 line-through"
                          : "border-white/[0.08] bg-white/[0.03] text-[#888] hover:text-[#ccc]"
                      }`}
                    >
                      <span>{p.emoji}</span>
                      <span className="max-w-[100px] truncate">
                        {p.display_name ?? p.agent_id}
                      </span>
                      {duplicate && (
                        <span
                          className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[9px] text-[#888]"
                          title={p.agent_id}
                        >
                          {p.agent_id.slice(0, 6)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
}
