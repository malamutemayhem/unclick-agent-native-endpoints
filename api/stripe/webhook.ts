/**
 * UnClick Stripe webhook handler
 *
 * Vercel serverless function at POST /api/stripe/webhook.
 *
 * Scope (scaffold only):
 *   1. Verify the Stripe-Signature header using the shared whsec_ secret.
 *   2. Log the verified event type and id.
 *   3. Return 200 so Stripe does not retry.
 *
 * Out of scope (follow-up work):
 *   - Writing subscription / invoice / payment events to Supabase.
 *   - Idempotency store keyed by Stripe event id.
 *   - Customer portal, Checkout, Connect onboarding.
 *
 * Required env vars (set in Vercel: Settings > Environment Variables):
 *   STRIPE_SECRET_KEY       - sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET   - whsec_... from the dashboard webhook config
 *
 * Note on bodyParser: Stripe signature verification requires the raw
 * request body. Vercel's default JSON body parser would mutate the
 * bytes, so we disable it here and read the stream ourselves.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    console.error("[stripe-webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let raw: Buffer;
  try {
    raw = await readRawBody(req);
  } catch (err) {
    console.error("[stripe-webhook] failed to read request body:", err);
    res.status(400).json({ error: "Failed to read request body" });
    return;
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[stripe-webhook] signature verification failed:", message);
    res.status(400).json({ error: "Signature verification failed" });
    return;
  }

  // Scaffold: log the verified event and ack. Handlers for specific event
  // types (subscription lifecycle, invoices, checkout completion) land in
  // follow-up PRs once the Supabase tables for billing state exist.
  console.log(`[stripe-webhook] received ${event.type} (id=${event.id})`);
  res.status(200).json({ received: true, type: event.type, id: event.id });
}
