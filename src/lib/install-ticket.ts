/**
 * Install-ticket helper.
 *
 * Swaps a raw `uc_...` key for a short-lived "unclick-{adj}-{noun}-{digits}"
 * handoff code that agents won't treat as a credential. Tickets are good
 * for 24 hours or one redemption, whichever comes first.
 */

const TICKET_STORAGE = "unclick_install_ticket";

interface StoredTicket {
  ticket: string;
  expires_at: string;
  api_key: string;
}

function readStored(): StoredTicket | null {
  try {
    const raw = localStorage.getItem(TICKET_STORAGE);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTicket;
  } catch {
    return null;
  }
}

function writeStored(entry: StoredTicket): void {
  try {
    localStorage.setItem(TICKET_STORAGE, JSON.stringify(entry));
  } catch {
    // Swallow; local storage is best-effort here.
  }
}

export function clearStoredTicket(): void {
  try {
    localStorage.removeItem(TICKET_STORAGE);
  } catch {
    // ignored
  }
}

async function issueRemote(apiKey: string): Promise<StoredTicket> {
  const response = await fetch("/api/install-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "issue", api_key: apiKey }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ticket?: string;
    expires_at?: string;
    error?: string;
  };
  if (!response.ok || !data.ticket || !data.expires_at) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return { ticket: data.ticket, expires_at: data.expires_at, api_key: apiKey };
}

/**
 * Return a ticket for the given api_key, reusing a cached one if it's still
 * valid for the same key and hasn't expired within a small safety window.
 */
export async function getOrIssueTicket(apiKey: string): Promise<StoredTicket> {
  const existing = readStored();
  const safetyMs = 30 * 60 * 1000; // refresh if <30 min left
  if (
    existing &&
    existing.api_key === apiKey &&
    new Date(existing.expires_at).getTime() - Date.now() > safetyMs
  ) {
    return existing;
  }
  const fresh = await issueRemote(apiKey);
  writeStored(fresh);
  return fresh;
}
