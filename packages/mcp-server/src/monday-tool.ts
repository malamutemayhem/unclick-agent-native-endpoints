// Monday.com project management API.
// Docs: https://developer.monday.com/api-reference/docs
// Auth: MONDAY_API_KEY (Bearer token)
// Base: https://api.monday.com/v2 (GraphQL)

const MONDAY_BASE = "https://api.monday.com/v2";

function getApiKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.MONDAY_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set MONDAY_API_KEY env var).");
  return key;
}

async function mondayQuery(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(MONDAY_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new Error("Invalid Monday.com API key.");
  if (res.status === 429) throw new Error("Monday.com rate limit exceeded.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Monday.com HTTP ${res.status}: ${body || res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  if (json.errors) {
    const msgs = (json.errors as Array<Record<string, unknown>>).map((e) => e.message).join("; ");
    throw new Error(`Monday.com GraphQL error: ${msgs}`);
  }
  return json.data;
}

// list_monday_boards
export async function listMondayBoards(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const limit = Number(args.limit ?? 25);
    const query = `
      query($limit: Int) {
        boards(limit: $limit) {
          id name description state board_kind
          columns { id title type }
        }
      }
    `;
    const data = await mondayQuery(apiKey, query, { limit }) as Record<string, unknown>;
    const boards = (data.boards ?? []) as Array<Record<string, unknown>>;
    return { count: boards.length, boards };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// get_monday_board
export async function getMondayBoard(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const query = `
      query($ids: [ID!]) {
        boards(ids: $ids) {
          id name description state board_kind
          columns { id title type }
          groups { id title color }
        }
      }
    `;
    const data = await mondayQuery(apiKey, query, { ids: [boardId] }) as Record<string, unknown>;
    const boards = (data.boards ?? []) as Array<Record<string, unknown>>;
    return boards[0] ?? { error: "Board not found." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// list_monday_items
export async function listMondayItems(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const limit = Number(args.limit ?? 50);
    const query = `
      query($ids: [ID!], $limit: Int) {
        boards(ids: $ids) {
          items_page(limit: $limit) {
            items {
              id name state created_at updated_at
              column_values { id text value }
              group { id title }
            }
          }
        }
      }
    `;
    const data = await mondayQuery(apiKey, query, { ids: [boardId], limit }) as Record<string, unknown>;
    const boards = (data.boards ?? []) as Array<Record<string, unknown>>;
    const board = boards[0] as Record<string, unknown> | undefined;
    const items = ((board?.items_page as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>;
    return { count: items.length, items };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// create_monday_item
export async function createMondayItem(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const itemName = String(args.item_name ?? "").trim();
    if (!itemName) return { error: "item_name is required." };

    const mutation = `
      mutation($board_id: ID!, $item_name: String!, $group_id: String, $column_values: JSON) {
        create_item(board_id: $board_id, item_name: $item_name, group_id: $group_id, column_values: $column_values) {
          id name state created_at
        }
      }
    `;
    const variables: Record<string, unknown> = { board_id: boardId, item_name: itemName };
    if (args.group_id) variables.group_id = String(args.group_id);
    if (args.column_values) variables.column_values = typeof args.column_values === "string"
      ? args.column_values
      : JSON.stringify(args.column_values);

    const data = await mondayQuery(apiKey, mutation, variables) as Record<string, unknown>;
    return data.create_item;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// update_monday_item
export async function updateMondayItem(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const itemId = String(args.item_id ?? "").trim();
    if (!itemId) return { error: "item_id is required." };
    const columnId = String(args.column_id ?? "").trim();
    if (!columnId) return { error: "column_id is required." };
    const value = args.value;
    if (value === undefined) return { error: "value is required." };

    const mutation = `
      mutation($board_id: ID!, $item_id: ID!, $column_id: String!, $value: JSON!) {
        change_column_value(board_id: $board_id, item_id: $item_id, column_id: $column_id, value: $value) {
          id name
        }
      }
    `;
    const data = await mondayQuery(apiKey, mutation, {
      board_id: boardId,
      item_id: itemId,
      column_id: columnId,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }) as Record<string, unknown>;
    return data.change_column_value;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// search_monday_items
export async function searchMondayItems(args: Record<string, unknown>): Promise<unknown> {
  try {
    const apiKey = getApiKey(args);
    const boardId = String(args.board_id ?? "").trim();
    if (!boardId) return { error: "board_id is required." };
    const query_text = String(args.query ?? "").trim();
    if (!query_text) return { error: "query is required." };
    const limit = Number(args.limit ?? 25);

    const query = `
      query($board_id: ID!, $query: String!, $limit: Int) {
        items_by_multiple_column_values(board_id: $board_id, limit: $limit, column_id: "name", column_values: [$query]) {
          id name state created_at updated_at
          column_values { id text value }
        }
      }
    `;
    const data = await mondayQuery(apiKey, query, { board_id: boardId, query: query_text, limit }) as Record<string, unknown>;
    const items = (data.items_by_multiple_column_values ?? []) as Array<Record<string, unknown>>;
    return { count: items.length, items };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
