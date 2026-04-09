/**
 * UnClick Developer Dashboard - Vercel serverless function
 *
 * Route: GET /api/developer-dashboard?developer_id=<uuid>
 *
 * Returns a developer's full dashboard data:
 *   - Tool submissions and their statuses
 *   - Approved marketplace tools with usage stats
 *   - Total earnings
 *   - Recent payout history
 *   - Pending payout estimate (current month calls x $0.0008 per call)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Developer earns $0.0008 per call (80% of $0.001 platform fee)
const REVENUE_PER_CALL = 0.0008;

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const developer_id = req.query.developer_id;
  if (!developer_id || typeof developer_id !== "string") {
    return res.status(400).json({ error: "developer_id query parameter is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing");
    return res.status(500).json({ error: "Database service unavailable. Please try again later." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

  // Fetch all data in parallel
  const [profileRes, submissionsRes, toolsRes, payoutsRes] = await Promise.all([
    supabase
      .from("developer_profiles")
      .select("id, email, github_username, stripe_onboarded, status, total_earned, created_at")
      .eq("id", developer_id)
      .single(),

    supabase
      .from("tool_submissions")
      .select("id, tool_name, category, description, api_name, github_url, status, review_notes, submitted_at, reviewed_at")
      .eq("developer_id", developer_id)
      .order("submitted_at", { ascending: false }),

    supabase
      .from("marketplace_tools")
      .select("id, tool_name, category, description, total_calls, total_revenue, developer_revenue, is_active, created_at")
      .eq("developer_id", developer_id)
      .eq("is_active", true),

    supabase
      .from("developer_payouts")
      .select("id, amount, stripe_transfer_id, period_start, period_end, status, created_at")
      .eq("developer_id", developer_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (profileRes.error) {
    if (profileRes.error.code === "PGRST116") {
      return res.status(404).json({ error: "Developer profile not found" });
    }
    console.error("Profile fetch error:", profileRes.error.message);
    return res.status(500).json({ error: "Failed to load developer profile" });
  }

  if (submissionsRes.error) {
    console.error("Submissions fetch error:", submissionsRes.error.message);
    return res.status(500).json({ error: "Failed to load tool submissions" });
  }

  if (toolsRes.error) {
    console.error("Tools fetch error:", toolsRes.error.message);
    return res.status(500).json({ error: "Failed to load marketplace tools" });
  }

  if (payoutsRes.error) {
    console.error("Payouts fetch error:", payoutsRes.error.message);
    return res.status(500).json({ error: "Failed to load payout history" });
  }

  const approvedTools = toolsRes.data ?? [];

  // Fetch current-month usage events for all approved tools to compute pending payout estimate
  let pendingCallsThisMonth = 0;
  if (approvedTools.length > 0) {
    const toolIds = approvedTools.map((t) => t.id);
    const { data: usageData, error: usageError } = await supabase
      .from("tool_usage_events")
      .select("tool_id, call_count")
      .in("tool_id", toolIds)
      .gte("recorded_at", monthStart)
      .lte("recorded_at", monthEnd);

    if (usageError) {
      console.error("Usage events fetch error:", usageError.message);
      // Non-fatal: pending estimate will be 0
    } else {
      for (const event of usageData ?? []) {
        pendingCallsThisMonth += event.call_count ?? 0;
      }
    }
  }

  const pendingPayoutEstimate = parseFloat((pendingCallsThisMonth * REVENUE_PER_CALL).toFixed(2));

  return res.status(200).json({
    profile: profileRes.data,
    submissions: submissionsRes.data ?? [],
    tools: approvedTools,
    payouts: payoutsRes.data ?? [],
    earnings: {
      total_earned: profileRes.data.total_earned ?? 0,
      pending_estimate: pendingPayoutEstimate,
      pending_calls_this_month: pendingCallsThisMonth,
      revenue_per_call: REVENUE_PER_CALL,
    },
  });
}
