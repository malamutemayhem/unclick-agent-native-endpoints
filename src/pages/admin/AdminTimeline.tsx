/**
 * AdminTimeline - Timeline surface (/admin/memory/timeline)
 *
 * What changed in your memory and when. Shows metering_events for the user's
 * api_key grouped by day, recent mc_conversation_log sessions,
 * and usage stats summary (calls today, this week, this month).
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth";
import {
  Activity,
  Loader2,
  BarChart3,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Brain,
  Settings as SettingsIcon,
  History,
} from "lucide-react";

interface MeteringEvent {
  id: string;
  platform: string;
  operation: string;
  success: boolean;
  response_ms: number | null;
  created_at: string;
}

interface ConversationSession {
  session_id: string;
  message_count: number;
  last_message: string;
}

interface TimelineEvent {
  event_type: "fact_created" | "context_updated" | "session_saved";
  id: string;
  created_at: string;
  summary: string;
  category?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() < days * 86_400_000;
}

export default function AdminTimeline() {
  const { session } = useSession();
  const [events, setEvents] = useState<MeteringEvent[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [activityRes, timelineRes] = await Promise.all([
          fetch("/api/memory-admin?action=admin_activity", { headers }),
          fetch("/api/memory-admin?action=admin_memory_timeline", { headers }),
        ]);
        if (!cancelled && activityRes.ok) {
          const body = await activityRes.json();
          setEvents(body.metering_events ?? []);
          setSessions(body.conversation_sessions ?? []);
        }
        if (!cancelled && timelineRes.ok) {
          const body = await timelineRes.json();
          setTimeline((body.timeline ?? []) as TimelineEvent[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session]);

  // Usage stats
  const stats = useMemo(() => {
    const today = events.filter((e) => isWithinDays(e.created_at, 1)).length;
    const week = events.filter((e) => isWithinDays(e.created_at, 7)).length;
    const month = events.filter((e) => isWithinDays(e.created_at, 30)).length;
    const successRate = events.length
      ? Math.round((events.filter((e) => e.success).length / events.length) * 100)
      : 0;
    const avgMs = events.length
      ? Math.round(
          events.reduce((sum, e) => sum + (e.response_ms ?? 0), 0) /
            events.filter((e) => e.response_ms != null).length || 0,
        )
      : 0;
    return { today, week, month, successRate, avgMs };
  }, [events]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, MeteringEvent[]>();
    for (const ev of events) {
      const key = dayKey(ev.created_at);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Timeline</h1>
        <p className="mt-1 text-sm text-[#888]">
          What changed in your memory and when
        </p>
        <p className="mt-3 text-sm text-[#888]">
          Every time your AI saves knowledge, writes a session summary, or
          updates your identity, it shows up here.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading activity...</span>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Zap}
              label="Today"
              value={stats.today.toString()}
              sub="API calls"
            />
            <StatCard
              icon={BarChart3}
              label="This week"
              value={stats.week.toString()}
              sub="API calls"
            />
            <StatCard
              icon={Activity}
              label="This month"
              value={stats.month.toString()}
              sub="API calls"
            />
            <StatCard
              icon={CheckCircle2}
              label="Success rate"
              value={`${stats.successRate}%`}
              sub={stats.avgMs > 0 ? `avg ${stats.avgMs}ms` : "no data"}
            />
          </div>

          {/* Recent memory changes timeline */}
          {timeline.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <History className="h-4 w-4 text-[#E2B93B]" />
                Recent Memory Changes
              </h2>
              <ol className="space-y-1">
                {timeline.slice(0, 15).map((ev) => (
                  <MemoryTimelineItem key={`${ev.event_type}-${ev.id}`} ev={ev} />
                ))}
              </ol>
            </div>
          )}

          {/* Two-column layout: events + conversations */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Recent API calls (3/5 width) */}
            <div className="lg:col-span-3">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <BarChart3 className="h-4 w-4 text-[#E2B93B]" />
                Recent API Calls
              </h2>

              {events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-6 text-center">
                  <p className="text-xs text-[#666]">
                    No API calls recorded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventsByDay.map(([day, dayEvents]) => (
                    <div key={day}>
                      <h4 className="mb-2 text-[11px] font-medium text-[#666]">
                        {day}
                        <span className="ml-2 text-[#555]">
                          ({dayEvents.length} call{dayEvents.length !== 1 ? "s" : ""})
                        </span>
                      </h4>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 10).map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-[#111111] px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              {ev.success ? (
                                <CheckCircle2 className="h-3 w-3 text-green-400" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-400" />
                              )}
                              <span className="text-xs font-medium text-white">
                                {ev.platform}
                              </span>
                              <span className="text-[11px] text-[#666]">
                                {ev.operation}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[#555]">
                              {ev.response_ms != null && (
                                <span>{ev.response_ms}ms</span>
                              )}
                              <span>{timeAgo(ev.created_at)}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 10 && (
                          <p className="py-1 text-center text-[10px] text-[#555]">
                            +{dayEvents.length - 10} more
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent conversations (2/5 width) */}
            <div className="lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-[#E2B93B]" />
                Recent Sessions
              </h2>

              {sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-6 text-center">
                  <p className="text-xs text-[#666]">
                    No conversation sessions recorded
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.session_id}
                      className="rounded-xl border border-white/[0.06] bg-[#111111] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <code className="truncate font-mono text-[11px] text-white">
                          {s.session_id.length > 20
                            ? `${s.session_id.slice(0, 20)}...`
                            : s.session_id}
                        </code>
                        <span className="shrink-0 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#888]">
                          {s.message_count} msg{s.message_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-[#555]">
                        <Clock className="h-3 w-3" />
                        {timeAgo(s.last_message)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4">
      <div className="flex items-center gap-2 text-xs text-[#888]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#555]">{sub}</p>
    </div>
  );
}

function MemoryTimelineItem({ ev }: { ev: TimelineEvent }) {
  const Icon =
    ev.event_type === "fact_created"
      ? Brain
      : ev.event_type === "context_updated"
        ? SettingsIcon
        : Clock;
  const label =
    ev.event_type === "fact_created"
      ? "New fact"
      : ev.event_type === "context_updated"
        ? "Context updated"
        : "Session saved";
  const accent =
    ev.event_type === "fact_created"
      ? "text-[#61C1C4]"
      : ev.event_type === "context_updated"
        ? "text-[#E2B93B]"
        : "text-white";

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-white/[0.04] bg-[#111111] px-3 py-2">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent}`} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[#666]">
            {label}
            {ev.category ? (
              <span className="ml-2 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] normal-case text-[#aaa]">
                {ev.category}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-[#ccc]">{ev.summary || "(no summary)"}</p>
        </div>
      </div>
      <span className="shrink-0 text-[10px] text-[#555]">{timeAgo(ev.created_at)}</span>
    </li>
  );
}
