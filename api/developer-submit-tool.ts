/**
 * UnClick Developer Tool Submission - Vercel serverless function
 *
 * Route: POST /api/developer-submit-tool
 *
 * No authentication required. Accepts tool submissions with just an email
 * address. Account creation is linked to approval notification.
 *
 * Sends two emails on receipt:
 *   1. Developer confirmation with review timeline and status check link
 *   2. Internal notification to the review team
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = [
  "automation",
  "business",
  "content",
  "data",
  "devtools",
  "finance",
  "life",
  "scheduling",
  "security",
  "web",
];

const APP_URL = "https://unclick.world";

// Returns the next business day at 9am UTC
function getReviewByDate(): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  const day = next.getUTCDay();
  if (day === 6) next.setUTCDate(next.getUTCDate() + 2); // Saturday -> Monday
  else if (day === 0) next.setUTCDate(next.getUTCDate() + 1); // Sunday -> Monday
  next.setUTCHours(9, 0, 0, 0);
  return next.toISOString();
}

async function sendDeveloperConfirmationEmail(params: {
  tool_name: string;
  contact_email: string;
  submission_id: string;
  review_by: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendDeveloperConfirmationEmail] RESEND_API_KEY not set - skipping email");
    return;
  }

  const { tool_name, contact_email, submission_id, review_by } = params;
  const statusUrl = `${APP_URL}/api/developer-submission-status?id=${submission_id}`;
  const docsUrl = `${APP_URL}/docs/developers`;
  const reviewByFormatted = new Date(review_by).toUTCString();

  const emailBody = [
    `Hi,`,
    ``,
    `We received your submission for "${tool_name}" and it is now in our review queue.`,
    ``,
    `Submission ID: ${submission_id}`,
    `Review deadline: ${reviewByFormatted}`,
    ``,
    `Track your submission status (no login required):`,
    statusUrl,
    ``,
    `Developer docs and next steps:`,
    docsUrl,
    ``,
    `Questions? Reply to this email or reach out at developers@unclick.world.`,
    ``,
    `The UnClick Team`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "UnClick Developer Platform <developers@unclick.world>",
        to: [contact_email],
        subject: `We received your UnClick tool submission: ${tool_name}`,
        text: emailBody,
      }),
    });
    if (!res.ok) {
      console.error("[sendDeveloperConfirmationEmail] Resend error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[sendDeveloperConfirmationEmail] Network error:", err);
  }
}

async function sendReviewNotificationEmail(params: {
  tool_name: string;
  category: string;
  description: string;
  api_name: string;
  github_url?: string;
  contact_email: string;
  submission_id: string;
  submitted_at: string;
  review_by: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendReviewNotificationEmail] RESEND_API_KEY not set - skipping email");
    return;
  }

  const { tool_name, category, description, api_name, github_url, contact_email, submission_id, submitted_at, review_by } = params;

  const emailBody = [
    `New tool submission received for review.`,
    ``,
    `Submission ID: ${submission_id}`,
    `Submitted: ${submitted_at}`,
    `Review by: ${review_by}`,
    ``,
    `Tool Name: ${tool_name}`,
    `Category: ${category}`,
    `API Name: ${api_name}`,
    `Developer Email: ${contact_email}`,
    github_url ? `GitHub URL: ${github_url}` : "",
    ``,
    `Description:`,
    description,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "UnClick Developer Platform <developers@unclick.world>",
        to: [process.env.ADMIN_NOTIFICATION_EMAIL || "review@unclick.world"],
        subject: `[UnClick Review] New Tool Submission: ${tool_name}`,
        text: emailBody,
      }),
    });
    if (!res.ok) {
      console.error("[sendReviewNotificationEmail] Resend error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[sendReviewNotificationEmail] Network error:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { tool_name, category, description, api_name, github_url, tool_file_content, contact_email } =
    req.body ?? {};

  if (!tool_name || typeof tool_name !== "string" || tool_name.trim().length < 2) {
    return res.status(400).json({ error: "tool_name is required (min 2 characters)" });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category is required. Valid options: ${VALID_CATEGORIES.join(", ")}` });
  }
  if (!description || typeof description !== "string" || description.trim().length < 20) {
    return res.status(400).json({ error: "description is required (min 20 characters)" });
  }
  if (!api_name || typeof api_name !== "string" || api_name.trim().length < 2) {
    return res.status(400).json({ error: "api_name is required (min 2 characters)" });
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return res.status(400).json({ error: "contact_email is required and must be a valid email address" });
  }
  if (!github_url && !tool_file_content) {
    return res.status(400).json({ error: "Either github_url or tool_file_content is required" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing - tool submission not persisted");
    return res.status(500).json({ error: "Submission service unavailable. Please try again later." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const review_by = getReviewByDate();

  const { data, error } = await supabase
    .from("tool_submissions")
    .insert({
      developer_id: null, // anonymous submission; linked to account on approval
      tool_name: tool_name.trim(),
      category,
      description: description.trim(),
      api_name: api_name.trim(),
      github_url: github_url ? String(github_url).trim() : null,
      tool_file_content: tool_file_content ? String(tool_file_content) : null,
      contact_email: contact_email.trim().toLowerCase(),
      status: "pending",
    })
    .select("id, submitted_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error.message);
    return res.status(500).json({ error: "Failed to submit tool. Please try again." });
  }

  const submittedAt = data.submitted_at ?? new Date().toISOString();

  // Fire both emails concurrently
  await Promise.all([
    sendDeveloperConfirmationEmail({
      tool_name: tool_name.trim(),
      contact_email: contact_email.trim().toLowerCase(),
      submission_id: data.id,
      review_by,
    }),
    sendReviewNotificationEmail({
      tool_name: tool_name.trim(),
      category,
      description: description.trim(),
      api_name: api_name.trim(),
      github_url: github_url ? String(github_url).trim() : undefined,
      contact_email: contact_email.trim().toLowerCase(),
      submission_id: data.id,
      submitted_at: submittedAt,
      review_by,
    }),
  ]);

  return res.status(201).json({
    success: true,
    submission_id: data.id,
    review_by,
    message: "Submitted! You'll hear back within 48 hours.",
  });
}
