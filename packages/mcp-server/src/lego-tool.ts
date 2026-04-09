// LEGO API integration: Rebrickable + BrickSet.
// Two APIs, one file.
//
// Rebrickable: https://rebrickable.com/api/v3/lego/
//   Env var: REBRICKABLE_API_KEY (header: Authorization: key {key})
//
// BrickSet: https://brickset.com/api/v3.asmx
//   Env var: BRICKSET_API_KEY

const REBRICKABLE_BASE = "https://rebrickable.com/api/v3/lego";
const BRICKSET_BASE = "https://brickset.com/api/v3.asmx";

// ─── Rebrickable helpers ──────────────────────────────────────────────────────

function requireRebrickableKey(args: Record<string, unknown>): string {
  const key = String(
    args.rebrickable_api_key ?? process.env.REBRICKABLE_API_KEY ?? ""
  ).trim();
  if (!key) {
    throw new Error(
      "REBRICKABLE_API_KEY is required. Get a free key at https://rebrickable.com/api/"
    );
  }
  return key;
}

async function rebrickableFetch<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${REBRICKABLE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `key ${apiKey}`,
      "User-Agent": "UnClickMCP/1.0 (https://unclick.io)",
    },
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Rebrickable API HTTP ${res.status}: ${String(body.detail ?? "Unknown error")}`
    );
  }
  return body as T;
}

// ─── lego_search_sets ─────────────────────────────────────────────────────────
// GET /sets/

export async function legoSearchSets(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireRebrickableKey(args);
  const params: Record<string, string> = {};
  if (args.search) params.search = String(args.search);
  if (args.theme_id) params.theme_id = String(args.theme_id);
  if (args.year) params.min_year = String(args.year), params.max_year = String(args.year);

  const data = await rebrickableFetch<Record<string, unknown>>(
    "/sets/",
    key,
    params
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    next: data.next ?? null,
    sets: results.map((s) => ({
      set_num: s.set_num,
      name: s.name,
      year: s.year,
      theme_id: s.theme_id ?? null,
      num_parts: s.num_parts,
      set_img_url: s.set_img_url ?? null,
      set_url: s.set_url ?? null,
    })),
  };
}

// ─── lego_get_set ─────────────────────────────────────────────────────────────
// GET /sets/{set_num}/

export async function legoGetSet(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireRebrickableKey(args);
  const setNum = String(args.set_num ?? "").trim();
  if (!setNum) return { error: "set_num is required (e.g. 75192-1)." };

  const data = await rebrickableFetch<Record<string, unknown>>(
    `/sets/${encodeURIComponent(setNum)}/`,
    key
  );

  return {
    set_num: data.set_num,
    name: data.name,
    year: data.year,
    theme_id: data.theme_id ?? null,
    num_parts: data.num_parts,
    set_img_url: data.set_img_url ?? null,
    set_url: data.set_url ?? null,
    last_modified_dt: data.last_modified_dt ?? null,
  };
}

// ─── lego_set_parts ───────────────────────────────────────────────────────────
// GET /sets/{set_num}/parts/

export async function legoSetParts(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireRebrickableKey(args);
  const setNum = String(args.set_num ?? "").trim();
  if (!setNum) return { error: "set_num is required (e.g. 75192-1)." };

  const data = await rebrickableFetch<Record<string, unknown>>(
    `/sets/${encodeURIComponent(setNum)}/parts/`,
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    set_num: setNum,
    count: data.count ?? 0,
    next: data.next ?? null,
    parts: results.map((p) => {
      const part = (p.part as Record<string, unknown>) ?? {};
      const color = (p.color as Record<string, unknown>) ?? {};
      return {
        id: p.id,
        quantity: p.quantity,
        is_spare: p.is_spare,
        part_num: part.part_num ?? null,
        part_name: part.name ?? null,
        part_img_url: part.part_img_url ?? null,
        color_id: color.id ?? null,
        color_name: color.name ?? null,
      };
    }),
  };
}

// ─── lego_search_parts ────────────────────────────────────────────────────────
// GET /parts/

export async function legoSearchParts(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireRebrickableKey(args);
  const params: Record<string, string> = {};
  if (args.search) params.search = String(args.search);
  if (args.color_id) params.color_id = String(args.color_id);

  const data = await rebrickableFetch<Record<string, unknown>>(
    "/parts/",
    key,
    params
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    next: data.next ?? null,
    parts: results.map((p) => ({
      part_num: p.part_num,
      name: p.name,
      part_cat_id: p.part_cat_id ?? null,
      part_url: p.part_url ?? null,
      part_img_url: p.part_img_url ?? null,
    })),
  };
}

// ─── lego_themes ──────────────────────────────────────────────────────────────
// GET /themes/

export async function legoThemes(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireRebrickableKey(args);
  const data = await rebrickableFetch<Record<string, unknown>>(
    "/themes/",
    key
  );
  const results = (data.results as Record<string, unknown>[]) ?? [];

  return {
    count: data.count ?? 0,
    themes: results.map((t) => ({
      id: t.id,
      parent_id: t.parent_id ?? null,
      name: t.name,
    })),
  };
}

// ─── BrickSet helpers ─────────────────────────────────────────────────────────

function requireBricksetKey(args: Record<string, unknown>): string {
  const key = String(
    args.brickset_api_key ?? process.env.BRICKSET_API_KEY ?? ""
  ).trim();
  if (!key) {
    throw new Error(
      "BRICKSET_API_KEY is required. Register at https://brickset.com/tools/webservices/requestkey"
    );
  }
  return key;
}

async function bricksetFetch(
  method: string,
  apiKey: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(`${BRICKSET_BASE}/${method}`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("userHash", "");
  url.searchParams.set("params", JSON.stringify(params));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });

  if (!res.ok) {
    throw new Error(`BrickSet API HTTP ${res.status}`);
  }

  const body = (await res.json()) as Record<string, unknown>;
  if (body.status === "error") {
    throw new Error(`BrickSet API error: ${String(body.message ?? "Unknown error")}`);
  }
  return body;
}

function normalizeBricksetSet(s: Record<string, unknown>) {
  return {
    set_id: s.setID,
    number: s.number,
    number_variant: s.numberVariant,
    name: s.name,
    year: s.year,
    theme: s.theme ?? null,
    theme_group: s.themeGroup ?? null,
    subtheme: s.subtheme ?? null,
    pieces: s.pieces ?? null,
    minifigs: s.minifigs ?? null,
    image: s.image
      ? (s.image as Record<string, unknown>).imageURL ?? null
      : null,
    thumbnail: s.image
      ? (s.image as Record<string, unknown>).thumbnailURL ?? null
      : null,
    rating: s.rating ?? null,
    review_count: s.reviewCount ?? null,
    instructions_count: s.instructionsCount ?? null,
    retail_price_us: s.LEGOCom
      ? ((s.LEGOCom as Record<string, unknown>).US as Record<string, unknown>)?.retailPrice ?? null
      : null,
    availability: s.availability ?? null,
    ean: s.EAN ?? null,
  };
}

// ─── brickset_search ──────────────────────────────────────────────────────────
// getSets with query, theme, year params

export async function bricksetSearch(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireBricksetKey(args);
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const params: Record<string, unknown> = { query, pageSize: 20, pageNumber: 1 };
  if (args.theme) params.theme = String(args.theme);
  if (args.year) params.year = String(args.year);

  const data = await bricksetFetch("getSets", key, params);
  const sets = (data.sets as Record<string, unknown>[]) ?? [];

  return {
    count: data.matches ?? sets.length,
    sets: sets.map(normalizeBricksetSet),
  };
}

// ─── brickset_get_set ─────────────────────────────────────────────────────────
// getSets with setNumber param

export async function bricksetGetSet(
  args: Record<string, unknown>
): Promise<unknown> {
  const key = requireBricksetKey(args);
  const setNumber = String(args.setNumber ?? "").trim();
  if (!setNumber) return { error: "setNumber is required (e.g. 75192-1)." };

  const data = await bricksetFetch("getSets", key, { setNumber, pageSize: 1 });
  const sets = (data.sets as Record<string, unknown>[]) ?? [];

  if (!sets.length) return { error: "Set not found.", set_number: setNumber };

  return normalizeBricksetSet(sets[0]);
}
