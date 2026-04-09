// ── Trello REST API tool ───────────────────────────────────────────────────
// Wraps the Trello REST API (https://api.trello.com/1) via fetch.
// Auth: api_key + token (both required for write operations).
// No external dependencies.

const TRELLO_API = "https://api.trello.com/1";

// ── Fetch helper ───────────────────────────────────────────────────────────────

async function trelloFetch(
  apiKey: string,
  token: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: Record<string, unknown>,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${TRELLO_API}${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept:       "application/json",
    "User-Agent": "UnClick-MCP/1.0",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { error: `Network error reaching Trello API: ${err instanceof Error ? err.message : String(err)}` };
  }

  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }

  if (response.status === 401) return { error: "Trello API key or token is invalid. Check api_key and token.", status: 401 };
  if (response.status === 403) return { error: "Insufficient permissions for this Trello resource.", status: 403 };
  if (response.status === 404) return { error: "Board, list, or card not found.", status: 404 };
  if (response.status === 429) return { error: "Trello rate limit exceeded. Please wait and retry.", status: 429 };

  if (!response.ok) {
    return { error: `Trello API error ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`, status: response.status };
  }

  return data;
}

// ── Action implementations ─────────────────────────────────────────────────────

async function getBoards(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const memberId = String(args.member_id ?? "me").trim();
  return trelloFetch(apiKey, token, "GET", `/members/${encodeURIComponent(memberId)}/boards`, undefined, {
    fields: "id,name,desc,url,closed,idOrganization",
    filter: args.filter ? String(args.filter) : "open",
  });
}

async function getLists(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const boardId = String(args.board_id ?? "").trim();
  if (!boardId) return { error: "board_id is required." };
  return trelloFetch(apiKey, token, "GET", `/boards/${encodeURIComponent(boardId)}/lists`, undefined, {
    filter: args.filter ? String(args.filter) : "open",
  });
}

async function getCards(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const listId  = String(args.list_id  ?? "").trim();
  const boardId = String(args.board_id ?? "").trim();
  if (listId) {
    return trelloFetch(apiKey, token, "GET", `/lists/${encodeURIComponent(listId)}/cards`, undefined, {
      fields: "id,name,desc,due,dueComplete,idList,idBoard,labels,url",
    });
  }
  if (boardId) {
    return trelloFetch(apiKey, token, "GET", `/boards/${encodeURIComponent(boardId)}/cards`, undefined, {
      fields: "id,name,desc,due,dueComplete,idList,idBoard,labels,url",
      filter: args.filter ? String(args.filter) : "open",
    });
  }
  return { error: "list_id or board_id is required." };
}

async function createCard(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const listId = String(args.list_id ?? "").trim();
  const name   = String(args.name    ?? "").trim();
  if (!listId) return { error: "list_id is required." };
  if (!name)   return { error: "name is required." };

  const body: Record<string, unknown> = { idList: listId, name };
  if (args.desc)     body.desc     = String(args.desc);
  if (args.due)      body.due      = String(args.due);
  if (args.pos)      body.pos      = String(args.pos);
  if (args.id_labels) body.idLabels = args.id_labels;

  return trelloFetch(apiKey, token, "POST", "/cards", body);
}

async function updateCard(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const cardId = String(args.card_id ?? "").trim();
  if (!cardId) return { error: "card_id is required." };

  const body: Record<string, unknown> = {};
  if (args.name !== undefined)        body.name        = String(args.name);
  if (args.desc !== undefined)        body.desc        = String(args.desc);
  if (args.due !== undefined)         body.due         = String(args.due);
  if (args.due_complete !== undefined) body.dueComplete = Boolean(args.due_complete);
  if (args.id_list !== undefined)     body.idList      = String(args.id_list);
  if (args.closed !== undefined)      body.closed      = Boolean(args.closed);
  if (args.pos !== undefined)         body.pos         = String(args.pos);

  return trelloFetch(apiKey, token, "PUT", `/cards/${encodeURIComponent(cardId)}`, body);
}

async function searchCards(apiKey: string, token: string, args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };
  return trelloFetch(apiKey, token, "GET", "/search", undefined, {
    query,
    modelTypes:      "cards",
    card_fields:     "id,name,desc,due,dueComplete,idList,idBoard,url",
    cards_limit:     args.limit ? Number(args.limit) : 20,
    card_board:      "true",
    card_list:       "true",
  });
}

// ── Public dispatcher ──────────────────────────────────────────────────────────

export async function trelloAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const apiKey = String(args.api_key ?? "").trim();
  const token  = String(args.token   ?? "").trim();
  if (!apiKey) return { error: "api_key is required." };
  if (!token)  return { error: "token is required." };

  try {
    switch (action) {
      case "get_boards":   return getBoards(apiKey, token, args);
      case "get_lists":    return getLists(apiKey, token, args);
      case "get_cards":    return getCards(apiKey, token, args);
      case "create_card":  return createCard(apiKey, token, args);
      case "update_card":  return updateCard(apiKey, token, args);
      case "search_cards": return searchCards(apiKey, token, args);
      default:
        return {
          error: `Unknown Trello action: "${action}". Valid actions: get_boards, get_lists, get_cards, create_card, update_card, search_cards.`,
        };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
