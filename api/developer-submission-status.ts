/**
 * UnClick Developer Submission Status - Vercel serverless function
 *
 * Route: GET /api/developer-submission-status?id=<submission_id>
 *
 * Unauthenticated. Allows developers to check the status of their tool
 * submission without creating an account or logging in.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const id = req.query.id;
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return res.status(400).json({ error: "id query parameter is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing");
    return res.status(500).json({ error: "Status service unavailable. Please try again later." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("tool_submissions")
    .select("id, tool_name, category, status, review_notes, submitted_at, reviewed_at")
    .eq("id", id.trim())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Submission not found. Check the ID and try again." });
    }
    console.error("Supabase fetch error:", error.message);
    return res.status(500).json({ error: "Failed to load submission status." });
  }

  return res.status(200).json({
    id: data.id,
    tool_name: data.tool_name,
    category: data.category,
    status: data.status,
    review_notes: data.review_notes ?? null,
    submitted_at: data.submitted_at,
    reviewed_at: data.reviewed_at ?? null,
  });
}
