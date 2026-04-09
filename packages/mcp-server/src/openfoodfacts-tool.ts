// ─── Open Food Facts Product Database ────────────────────────────────────────
// Free, open-source food product database — no auth required.
// Docs: https://wiki.openfoodfacts.org/API

const OFF_BASE = "https://world.openfoodfacts.org";

// ─── API helper ──────────────────────────────────────────────────────────────

async function offFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "UnClick-MCP/1.0 (mcp@unclick.io)" },
  });
  if (!res.ok) {
    throw new Error(`Open Food Facts API HTTP ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

function mapProduct(p: Record<string, unknown>) {
  return {
    code:             p.code ?? p._id,
    product_name:     p.product_name ?? p.product_name_en ?? null,
    brands:           p.brands         ?? null,
    categories:       p.categories     ?? null,
    quantity:         p.quantity        ?? null,
    image_url:        p.image_url       ?? null,
    nutriscore_grade: p.nutriscore_grade ?? null,
    ecoscore_grade:   p.ecoscore_grade  ?? null,
    nova_group:       p.nova_group      ?? null,
    ingredients_text: p.ingredients_text ?? null,
    allergens:        p.allergens        ?? null,
    labels:           p.labels           ?? null,
    countries:        p.countries        ?? null,
    nutriments: p.nutriments
      ? {
          energy_kcal_100g:   (p.nutriments as Record<string, unknown>)["energy-kcal_100g"] ?? null,
          fat_100g:            (p.nutriments as Record<string, unknown>)["fat_100g"] ?? null,
          saturated_fat_100g:  (p.nutriments as Record<string, unknown>)["saturated-fat_100g"] ?? null,
          carbohydrates_100g:  (p.nutriments as Record<string, unknown>)["carbohydrates_100g"] ?? null,
          sugars_100g:         (p.nutriments as Record<string, unknown>)["sugars_100g"] ?? null,
          fiber_100g:          (p.nutriments as Record<string, unknown>)["fiber_100g"] ?? null,
          proteins_100g:       (p.nutriments as Record<string, unknown>)["proteins_100g"] ?? null,
          salt_100g:           (p.nutriments as Record<string, unknown>)["salt_100g"] ?? null,
        }
      : null,
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function searchFoodProducts(
  args: Record<string, unknown>
): Promise<unknown> {
  const query    = String(args.query ?? args.search_terms ?? "").trim();
  if (!query) throw new Error("query is required.");

  const page     = Math.max(1, Number(args.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(args.page_size ?? 10)));

  const url = new URL(`${OFF_BASE}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("json",         "1");
  url.searchParams.set("page",         String(page));
  url.searchParams.set("page_size",    String(pageSize));
  url.searchParams.set("fields",
    "code,product_name,brands,categories,quantity,image_url,nutriscore_grade,ecoscore_grade,nova_group,nutriments"
  );

  interface SearchResponse {
    count:    number;
    page:     number;
    page_size: number;
    products: Record<string, unknown>[];
  }

  const data = await offFetch<SearchResponse>(url.toString());

  return {
    query,
    count:    data.count,
    page,
    page_size: pageSize,
    products: (data.products ?? []).map(mapProduct),
  };
}

export async function getFoodProduct(
  args: Record<string, unknown>
): Promise<unknown> {
  const barcode = String(args.barcode ?? "").trim().replace(/[^0-9]/g, "");
  if (!barcode) throw new Error("barcode is required (numeric EAN/UPC code).");

  interface ProductResponse {
    status:  number;
    product: Record<string, unknown>;
  }

  const data = await offFetch<ProductResponse>(
    `${OFF_BASE}/api/v2/product/${barcode}.json`
  );

  if (data.status !== 1 || !data.product) {
    return { error: `Product with barcode ${barcode} not found.` };
  }

  return mapProduct({ ...data.product, code: barcode });
}

export async function getFoodByCategory(
  args: Record<string, unknown>
): Promise<unknown> {
  const category = String(args.category ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!category) throw new Error("category is required (e.g. 'biscuits', 'dairy').");

  const page     = Math.max(1, Number(args.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(args.page_size ?? 10)));

  const url = new URL(`${OFF_BASE}/category/${category}.json`);
  url.searchParams.set("page",      String(page));
  url.searchParams.set("page_size", String(pageSize));

  interface CategoryResponse {
    count:    number;
    products: Record<string, unknown>[];
  }

  const data = await offFetch<CategoryResponse>(url.toString());

  return {
    category,
    count:    data.count ?? 0,
    page,
    products: (data.products ?? []).slice(0, pageSize).map(mapProduct),
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function openFoodFactsAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case "search_food_products": return searchFoodProducts(args);
    case "get_food_product":     return getFoodProduct(args);
    case "get_food_by_category": return getFoodByCategory(args);
    default:
      return {
        error:
          `Unknown Open Food Facts action: "${action}". ` +
          "Valid: search_food_products, get_food_product, get_food_by_category.",
      };
  }
}
