/**
 * AdminActivity - Activity surface (/admin/activity)
 *
 * What the agent has done. Shows metering_events for the user's
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
  UserPlus,
  ShieldCheck,
  ShieldAlert,
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

interface SignupUser {
  id: string;
  email: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
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

export default function AdminActivity() {
  const { session } = useSession();
  const [events, setEvents] = useState<MeteringEvent[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);
  // Admin-only recent signups. Hidden when the API returns 403 — non-admins
  // never see the card exists, admins see a live list from auth.users.
  const [signups, setSignups] = useState<SignupUser[] | null>(null);
  const [signupsLoading, setSignupsLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/memory-admin?action=admin_activity", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!cancelled && res.ok) {
          const body = await res.json();
          setEvents(body.metering_events ?? []);
          setSessions(body.conversation_sessions ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Separately probe the superadmin-only recent signups endpoint. A 403
    // means "not an admin" → hide the widget silently. Any other failure
    // also hides it so we never leak half-rendered scaffolding.
    (async () => {
      try {
        const res = await fetch("/api/admin-users?action=admin_recent_signups", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!cancelled) {
          if (res.ok) {
            const body = await res.json();
            setSignups(body.users ?? []);
          } else {
            setSignups(null);
          }
        }
      } catch {
        if (!cancelled) setSignups(null);
      } finally {
        if (!cancelled) setSignupsLoading(false);
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
        <h1 className="text-2xl font-semibold text-white">Activity</h1>
        <p className="mt-1 text-sm text-[#888]">
          Agent usage, API calls, and conversation history
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

          {/* Admin-only: Recent signups. Hidden for non-admins (API
              returns 403 → signups stays null). */}
          {!signupsLoading && signups !== null && (
            <div className="mt-8">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <UserPlus className="h-4 w-4 text-[#E2B93B]" />
                Recent Signups
                <span className="ml-1 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-[#888]">
                  admin only
                </span>
              </h2>

              {signups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#111111] p-6 text-center">
                  <p className="text-xs text-[#666]">No signups yet</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111111]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-[#666]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Provider</th>
                        <th className="px-3 py-2 font-medium">Confirmed</th>
                        <th className="px-3 py-2 font-medium">Signed up</th>
                        <th className="px-3 py-2 font-medium">Last seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {signups.slice(0, 50).map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-[11px] text-white">
                            {u.email ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-[#888]">{u.provider}</td>
                          <td className="px-3 py-2">
                            {u.confirmed ? (
                              <span className="flex items-center gap-1 text-green-400">
                                <ShieldCheck className="h-3 w-3" /> yes
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-400">
                                <ShieldAlert className="h-3 w-3" /> pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#888]">
                            {timeAgo(u.created_at)}
                          </td>
                          <td className="px-3 py-2 text-[#666]">
                            {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {signups.length > 50 && (
                    <p className="border-t border-white/[0.04] py-2 text-center text-[10px] text-[#555]">
                      +{signups.length - 50} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
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
