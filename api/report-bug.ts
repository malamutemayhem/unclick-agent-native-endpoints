/**
 * UnClick Bug Reporter - Vercel serverless function
 *
 * Route: POST /v1/report-bug
 *
 * Accepts agent-submitted bug reports, auto-classifies severity, and stores
 * them in the Supabase `bug_reports` table.
 *
 * Run this SQL in Supabase SQL Editor to create the table:
 *
 * CREATE TABLE bug_reports (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   tool_name TEXT NOT NULL,
 *   error_message TEXT NOT NULL,
 *   request_payload JSONB,
 *   expected_behavior TEXT,
 *   agent_context TEXT,
 *   severity TEXT NOT NULL DEFAULT 'medium',
 *   status TEXT NOT NULL DEFAULT 'open',
 *   resolution_notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Allow agent inserts" ON bug_reports
 *   FOR INSERT WITH CHECK (true);
 *
 * CREATE POLICY "Allow status reads" ON bug_reports
 *   FOR SELECT USING (true);
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

function classifySeverity(errorMessage: string, requestPayload?: unknown): string {
  const msg = errorMessage.toLowerCase();

  // Critical: server errors, panics, data loss signals
  if (
    msg.includes("500") ||
    msg.includes("internal server error") ||
    msg.includes("panic") ||
    msg.includes("fatal") ||
    msg.includes("data loss") ||
    msg.includes("corruption")
  ) {
    return "critical";
  }

  // High: timeouts, service unavailable, auth failures
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("service unavailable") ||
    msg.includes("unauthorized") ||
    msg.includes("403")
  ) {
    return "high";
  }

  // Low: not found, validation
  if (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("validation") ||
    msg.includes("invalid")
  ) {
    return "low";
  }

  // Default to medium for 4xx and anything else
  return "medium";
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tool_name, error_message, request_payload, expected_behavior, agent_context } =
    req.body ?? {};

  if (!tool_name || !error_message) {
    return res.status(400).json({
      error: "tool_name and error_message are required",
    });
  }

  const severity = classifySeverity(String(error_message), request_payload);

  // ---------------------------------------------------------------------------
  // Supabase write
  // ---------------------------------------------------------------------------

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Graceful degradation: log and return success shape so agents aren't blocked
    console.error("Supabase env vars missing - bug report not persisted");
    return res.status(200).json({
      id: null,
      severity,
      status: "open",
      persisted: false,
      message: "Bug report received (storage unavailable)",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      tool_name: String(tool_name),
      error_message: String(error_message),
      request_payload: request_payload ?? null,
      expected_behavior: expected_behavior ? String(expected_behavior) : null,
      agent_context: agent_context ? String(agent_context) : null,
      severity,
      status: "open",
    })
    .select("id, severity, status, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error.message);
    return res.status(500).json({ error: "Failed to store bug report", detail: error.message });
  }

  return res.status(201).json({
    ...data,
    persisted: true,
    message: "Bug report filed",
  });
}
