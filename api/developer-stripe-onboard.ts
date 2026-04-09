/**
 * UnClick Developer Stripe Connect Onboarding - Vercel serverless function
 *
 * Route: POST /api/developer-stripe-onboard
 *
 * Triggered only when a developer requests their first payout or their
 * balance hits $5. Not called at signup. Sets stripe_onboarding_deferred=false
 * on the developer profile when initiated.
 *
 * Body params:
 *   - developer_id: UUID of the developer_profiles record
 *   - email: developer email address
 *   - return_url: URL to redirect to after onboarding completes
 *   - refresh_url: URL to redirect to if the onboarding link expires
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY not set");
    return res.status(500).json({ error: "Payment service unavailable. Please try again later." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing");
    return res.status(500).json({ error: "Database service unavailable. Please try again later." });
  }

  const { developer_id, email, return_url, refresh_url } = req.body ?? {};

  if (!developer_id || typeof developer_id !== "string") {
    return res.status(400).json({ error: "developer_id is required" });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "email is required and must be valid" });
  }
  if (!return_url || typeof return_url !== "string") {
    return res.status(400).json({ error: "return_url is required" });
  }
  if (!refresh_url || typeof refresh_url !== "string") {
    return res.status(400).json({ error: "refresh_url is required" });
  }

  // Step 1: Create a Stripe Connect Express account
  let stripeAccountId: string;
  try {
    const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        type: "express",
        email,
        "capabilities[transfers][requested]": "true",
        "settings[payouts][schedule][interval]": "monthly",
      }).toString(),
    });

    if (!accountRes.ok) {
      const body = await accountRes.text();
      console.error("Stripe account create error:", accountRes.status, body);
      return res.status(502).json({ error: "Failed to create payment account. Please try again." });
    }

    const account = await accountRes.json();
    stripeAccountId = account.id;
  } catch (err) {
    console.error("Stripe account create network error:", err);
    return res.status(502).json({ error: "Failed to reach payment service. Please try again." });
  }

  // Step 2: Generate an account link for onboarding
  let onboardingUrl: string;
  try {
    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: stripeAccountId,
        refresh_url,
        return_url,
        type: "account_onboarding",
      }).toString(),
    });

    if (!linkRes.ok) {
      const body = await linkRes.text();
      console.error("Stripe account link error:", linkRes.status, body);
      return res.status(502).json({ error: "Failed to generate onboarding link. Please try again." });
    }

    const link = await linkRes.json();
    onboardingUrl = link.url;
  } catch (err) {
    console.error("Stripe account link network error:", err);
    return res.status(502).json({ error: "Failed to reach payment service. Please try again." });
  }

  // Step 3: Persist stripe_account_id and mark onboarding as initiated (no longer deferred)
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error: updateError } = await supabase
    .from("developer_profiles")
    .update({
      stripe_account_id: stripeAccountId,
      stripe_onboarding_deferred: false, // onboarding has been initiated
      stripe_onboarded: false, // set to true via Stripe webhook on completion
    })
    .eq("id", developer_id);

  if (updateError) {
    console.error("Supabase update error:", updateError.message);
    // Non-fatal: return the onboarding URL so the developer can still proceed
    console.warn("Could not persist stripe_account_id for developer:", developer_id);
  }

  return res.status(200).json({
    success: true,
    stripe_account_id: stripeAccountId,
    onboarding_url: onboardingUrl,
  });
}
