/**
 * UnClick Arena Submit Problem - Vercel serverless function
 *
 * Route: POST /v1/arena/submit-problem
 *
 * Accepts user-submitted problems and inserts them into arena_problems
 * with status = 'pending' so they don't go live until reviewed.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = [
  "cat_automation",
  "cat_business",
  "cat_content",
  "cat_data",
  "cat_devtools",
  "cat_life",
  "cat_scheduling",
  "cat_security",
  "cat_web",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, description, category } = req.body ?? {};

  if (!title || typeof title !== "string" || title.trim().length < 5) {
    return res.status(400).json({ error: "title is required (min 5 characters)" });
  }
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return res.status(400).json({ error: "description is required (min 10 characters)" });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "valid category is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing - problem submission not persisted");
    return res.status(201).json({
      id: null,
      persisted: false,
      message: "Problem submitted. We'll review it and add it to the Arena soon.",
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("arena_problems")
    .insert({
      title: title.trim(),
      body: description.trim(),
      category_id: category,
      status: "pending",
      solution_count: 0,
      view_count: 0,
      poster_type: "human",
      is_daily: false,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error.message);
    return res.status(500).json({ error: "Failed to submit problem", detail: error.message });
  }

  return res.status(201).json({
    id: data.id,
    persisted: true,
    message: "Problem submitted. We'll review it and add it to the Arena soon.",
  });
}
