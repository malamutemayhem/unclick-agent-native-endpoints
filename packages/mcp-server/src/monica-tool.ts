// ── Monica CRM API tool ────────────────────────────────────────────────────────
// Wraps the Monica personal CRM REST API via fetch.
// Default base: https://app.monicahq.com/api (override via MONICA_BASE_URL env var).
// Auth: Bearer token (MONICA_API_KEY).
//
// Credentials are auto-resolved via vault-bridge:
//   1. Inline args   (api_key passed directly)
//   2. Env var       UNCLICK_MONICA_API_KEY
//   3. Local vault   key "monica/api_key"
//   4. Supabase      via UNCLICK_API_KEY + unclick.world/api/credentials
//
// No external dependencies.

import { resolveCredentials } from "./vault-bridge.js";

function monicaBase(): string {
  return (process.env.MONICA_BASE_URL ?? "https://app.monicahq.com/api").replace(/\/$/, "");
}

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function monicaFetch(
  token: string,
  method: "GET" | "POST",
  path: string,
  query?: Record<string, string | number | undefined>,
  body?: unknown
): Promise<unknown> {
  const url = new URL(`${monicaBase()}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Monica API: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (response.status === 401) return { error: "Monica API key is invalid. Check your MONICA_API_KEY.", status: 401 };
  if (response.status === 404) return { error: "Resource not found. Check the contact or note ID.", status: 404 };
  if (response.status === 429) return { error: "Monica rate limit exceeded. Please wait and retry.", status: 429 };

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? text;
    return { error: `Monica API error ${response.status}: ${detail}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getContacts(token: string, args: Record<string, unknown>): Promise<unknown> {
  return monicaFetch(token, "GET", "/contacts", {
    page:  args.page ? Number(args.page) : 1,
    limit: args.limit ? Number(args.limit) : 30,
  });
}

async function searchContacts(token: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  return monicaFetch(token, "GET", "/contacts", { query, page: 1 });
}

async function getContact(token: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.contact_id ?? "").trim();
  if (!id) return { error: "contact_id is required." };
  return monicaFetch(token, "GET", `/contacts/${encodeURIComponent(id)}`);
}

async function createContact(token: string, args: Record<string, unknown>): Promise<unknown> {
  const first_name = String(args.first_name ?? "").trim();
  if (!first_name) return { error: "first_name is required." };

  const body: Record<string, unknown> = { first_name };
  if (args.last_name)         body.last_name         = String(args.last_name);
  if (args.nickname)          body.nickname          = String(args.nickname);
  if (args.gender_id)         body.gender_id         = Number(args.gender_id);
  if (args.birthdate_day)     body.birthdate_day     = Number(args.birthdate_day);
  if (args.birthdate_month)   body.birthdate_month   = Number(args.birthdate_month);
  if (args.birthdate_year)    body.birthdate_year    = Number(args.birthdate_year);
  if (args.is_partial !== undefined) body.is_partial = Boolean(args.is_partial);

  return monicaFetch(token, "POST", "/contacts", undefined, body);
}

async function getReminders(token: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.contact_id ?? "").trim();
  if (!id) return { error: "contact_id is required." };
  return monicaFetch(token, "GET", `/contacts/${encodeURIComponent(id)}/reminders`);
}

async function getActivities(token: string, args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.contact_id ?? "").trim();
  if (!id) return { error: "contact_id is required." };
  return monicaFetch(token, "GET", `/contacts/${encodeURIComponent(id)}/activities`, {
    page:  args.page ? Number(args.page) : 1,
    limit: args.limit ? Number(args.limit) : 20,
  });
}

async function addNote(token: string, args: Record<string, unknown>): Promise<unknown> {
  const contact_id = String(args.contact_id ?? "").trim();
  const body_text  = String(args.body ?? "").trim();
  if (!contact_id) return { error: "contact_id is required." };
  if (!body_text)  return { error: "body is required." };

  const payload: Record<string, unknown> = {
    contact_id: Number(contact_id),
    body:       body_text,
  };
  if (args.is_favorited !== undefined) payload.is_favorited = Boolean(args.is_favorited);

  return monicaFetch(token, "POST", "/notes", undefined, payload);
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function monicaAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const resolved = await resolveCredentials("monica", args);
  if ("error" in resolved) return resolved;

  const token = String(resolved.api_key ?? "").trim();
  if (!token) return { error: "Monica api_key could not be resolved." };

  try {
    switch (action) {
      case "get_contacts":          return getContacts(token, args);
      case "search_contacts":       return searchContacts(token, args);
      case "get_contact":           return getContact(token, args);
      case "create_contact":        return createContact(token, args);
      case "get_contact_reminders": return getReminders(token, args);
      case "get_activities":        return getActivities(token, args);
      case "add_note":              return addNote(token, args);
      default:
        return {
          error: `Unknown Monica action: "${action}". Valid actions: get_contacts, search_contacts, get_contact, create_contact, get_contact_reminders, get_activities, add_note.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
