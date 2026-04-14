/**
 * UnClick Install Tickets - Vercel serverless function
 *
 * Short-lived handoff codes that the MCP server exchanges for a real API key
 * on first boot. Designed so the string pasted into a chat doesn't look like
 * a credential and is dead after 24 hours or first redemption (whichever
 * comes first).
 *
 * Route: POST /api/install-ticket
 *   body: { action: "issue",  api_key: "uc_..." }
 *     → { ticket, expires_at }
 *   body: { action: "redeem", ticket: "unclick-ember-falcon-2847" }
 *     → { api_key }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ─── Ticket wordlists ──────────────────────────────────────────────────────
//
// Kept intentionally benign and short. ~60 * ~60 * 10000 = 36M combinations
// per 24h window; plenty for our scale and unguessable for a per-redemption
// attacker while staying readable and obviously not a credential.

const ADJECTIVES = [
  "amber", "azure", "brave", "breezy", "bright", "calm", "clever", "coral",
  "cosmic", "crisp", "dandy", "eager", "ember", "fancy", "frosty", "gentle",
  "golden", "happy", "jolly", "keen", "lively", "lucky", "merry", "mighty",
  "misty", "nimble", "noble", "olive", "plucky", "proud", "quick", "radiant",
  "rapid", "rosy", "ruby", "rustic", "sage", "scarlet", "silent", "silver",
  "sleek", "smooth", "snappy", "sparkly", "spry", "stellar", "sturdy", "sunny",
  "swift", "tangy", "tidy", "tranquil", "vivid", "warm", "witty", "wooly",
  "woven", "zesty", "zippy",
];

const NOUNS = [
  "acorn", "anchor", "badger", "beetle", "bison", "breeze", "cactus", "canyon",
  "cedar", "cliff", "cobra", "comet", "compass", "coral", "crane", "creek",
  "dragon", "eagle", "ember", "falcon", "ferret", "finch", "forest", "fox",
  "glacier", "harbor", "heron", "ibex", "island", "jaguar", "juniper", "lantern",
  "lion", "lynx", "maple", "marlin", "meadow", "monsoon", "moth", "orchid",
  "osprey", "otter", "panda", "pebble", "pine", "puffin", "raven", "reef",
  "river", "shore", "sparrow", "spruce", "stag", "sumac", "tiger", "tundra",
  "turtle", "violet", "willow", "wolf", "wren",
];

function randomWord(list: string[]): string {
  const idx = crypto.randomInt(0, list.length);
  return list[idx];
}

function generateTicket(): string {
  const adj = randomWord(ADJECTIVES);
  const noun = randomWord(NOUNS);
  const suffix = String(crypto.randomInt(1000, 10000));
  return `unclick-${adj}-${noun}-${suffix}`;
}

function isValidTicketShape(ticket: unknown): ticket is string {
  return (
    typeof ticket === "string" &&
    /^unclick-[a-z]+-[a-z]+-\d{4}$/.test(ticket)
  );
}

function isValidApiKeyShape(key: unknown): key is string {
  return typeof key === "string" && /^uc_[a-f0-9]{16,}$/.test(key);
}

// ─── Handler ───────────────────────────────────────────────────────────────

const TICKET_TTL_HOURS = 24;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database service unavailable" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action;

  try {
    if (action === "issue") {
      const apiKey = body.api_key;
      if (!isValidApiKeyShape(apiKey)) {
        return res.status(400).json({ error: "Invalid api_key" });
      }

      // Verify the API key is real and active.
      const { data: keyRow, error: keyErr } = await supabase
        .from("api_keys")
        .select("api_key, status")
        .eq("api_key", apiKey)
        .eq("status", "active")
        .maybeSingle();
      if (keyErr) throw keyErr;
      if (!keyRow) {
        return res.status(404).json({ error: "API key not found" });
      }

      // Try a few times in case of collision on the small readable space.
      let ticket = "";
      let expiresAt = new Date(
        Date.now() + TICKET_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString();
      for (let attempt = 0; attempt < 5; attempt++) {
        ticket = generateTicket();
        const { error: insertErr } = await supabase
          .from("install_tickets")
          .insert({ ticket, api_key: apiKey, expires_at: expiresAt });
        if (!insertErr) break;
        // 23505 = unique violation, retry. Anything else, bail.
        if ((insertErr as { code?: string }).code !== "23505") throw insertErr;
        ticket = "";
      }
      if (!ticket) {
        return res
          .status(500)
          .json({ error: "Could not allocate ticket, try again" });
      }

      return res.status(200).json({ ticket, expires_at: expiresAt });
    }

    if (action === "redeem") {
      const ticket = body.ticket;
      if (!isValidTicketShape(ticket)) {
        return res.status(400).json({ error: "Invalid ticket format" });
      }

      const { data: row, error: selErr } = await supabase
        .from("install_tickets")
        .select("api_key, expires_at, redeemed_at")
        .eq("ticket", ticket)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!row) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      if (row.redeemed_at) {
        return res
          .status(410)
          .json({ error: "Ticket already redeemed. Get a fresh one at https://unclick.world/i" });
      }
      if (new Date(row.expires_at as string).getTime() < Date.now()) {
        return res
          .status(410)
          .json({ error: "Ticket expired. Get a fresh one at https://unclick.world/i" });
      }

      // Mark redeemed. If update fails to find a still-unredeemed row, someone
      // raced us and won; treat that as already-redeemed.
      const { data: updated, error: updErr } = await supabase
        .from("install_tickets")
        .update({ redeemed_at: new Date().toISOString() })
        .eq("ticket", ticket)
        .is("redeemed_at", null)
        .select("api_key")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) {
        return res
          .status(410)
          .json({ error: "Ticket already redeemed. Get a fresh one at https://unclick.world/i" });
      }

      return res.status(200).json({ api_key: updated.api_key });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[install-ticket] error", message);
    return res.status(500).json({ error: "Internal error" });
  }
}
