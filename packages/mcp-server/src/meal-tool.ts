// TheMealDB recipe finder.
// No API key required -- free public API.
// Base URL: https://www.themealdb.com/api/json/v1/1/

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

interface MealSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string;
  strCategory?: string;
  strArea?: string;
}

interface MealDetail extends MealSummary {
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strYoutube?: string;
  strTags?: string;
  [key: string]: unknown;
}

interface MealListResponse {
  meals: MealSummary[] | MealDetail[] | null;
}

interface CategoryItem {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

interface CategoryResponse {
  categories: CategoryItem[];
}

async function mealFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${MEALDB_BASE}${path}`, {
    headers: { "User-Agent": "UnClickMCP/1.0 (https://unclick.io)" },
  });
  if (!res.ok) throw new Error(`TheMealDB HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function extractIngredients(meal: MealDetail): Array<{ ingredient: string; measure: string }> {
  const list: Array<{ ingredient: string; measure: string }> = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = String(meal[`strIngredient${i}`] ?? "").trim();
    const measure = String(meal[`strMeasure${i}`] ?? "").trim();
    if (ingredient) list.push({ ingredient, measure });
  }
  return list;
}

function normalizeMeal(meal: MealDetail) {
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    category: meal.strCategory ?? null,
    area: meal.strArea ?? null,
    instructions: meal.strInstructions ?? null,
    thumbnail: meal.strMealThumb ?? null,
    tags: meal.strTags ? meal.strTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    youtube: meal.strYoutube ?? null,
    ingredients: extractIngredients(meal),
  };
}

// ─── search_meals ─────────────────────────────────────────────────────────────

export async function searchMeals(args: Record<string, unknown>): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required." };

  const data = await mealFetch<MealListResponse>(`/search.php?s=${encodeURIComponent(query)}`);

  if (!data.meals) {
    return { query, count: 0, meals: [], message: `No meals found matching "${query}".` };
  }

  return {
    query,
    count: data.meals.length,
    meals: (data.meals as MealDetail[]).map(normalizeMeal),
  };
}

// ─── get_random_meal ──────────────────────────────────────────────────────────

export async function getRandomMeal(_args: Record<string, unknown>): Promise<unknown> {
  const data = await mealFetch<MealListResponse>("/random.php");
  if (!data.meals?.[0]) return { error: "No meal returned." };

  return {
    meal: normalizeMeal(data.meals[0] as MealDetail),
  };
}

// ─── get_meal_by_id ───────────────────────────────────────────────────────────

export async function getMealById(args: Record<string, unknown>): Promise<unknown> {
  const id = String(args.id ?? "").trim();
  if (!id) return { error: "id is required (TheMealDB meal ID)." };

  const data = await mealFetch<MealListResponse>(`/lookup.php?i=${encodeURIComponent(id)}`);
  if (!data.meals?.[0]) return { error: `No meal found with id "${id}".` };

  return { meal: normalizeMeal(data.meals[0] as MealDetail) };
}

// ─── list_meal_categories ─────────────────────────────────────────────────────

export async function listMealCategories(_args: Record<string, unknown>): Promise<unknown> {
  const data = await mealFetch<CategoryResponse>("/categories.php");

  return {
    count: data.categories.length,
    categories: data.categories.map((c) => ({
      id: c.idCategory,
      name: c.strCategory,
      description: c.strCategoryDescription,
      thumbnail: c.strCategoryThumb,
    })),
  };
}

// ─── filter_meals_by_category ─────────────────────────────────────────────────

export async function filterMealsByCategory(args: Record<string, unknown>): Promise<unknown> {
  const category = String(args.category ?? "").trim();
  if (!category) return { error: "category is required (e.g. Seafood, Dessert, Chicken)." };

  const data = await mealFetch<MealListResponse>(`/filter.php?c=${encodeURIComponent(category)}`);

  if (!data.meals) {
    return { category, count: 0, meals: [], message: `No meals found for category "${category}".` };
  }

  return {
    category,
    count: data.meals.length,
    meals: data.meals.map((m) => ({
      id: m.idMeal,
      name: m.strMeal,
      thumbnail: m.strMealThumb ?? null,
    })),
    tip: "Use get_meal_by_id with any id above to get full recipe details.",
  };
}

// ─── filter_meals_by_area ─────────────────────────────────────────────────────

export async function filterMealsByArea(args: Record<string, unknown>): Promise<unknown> {
  const area = String(args.area ?? "").trim();
  if (!area) return { error: "area is required (e.g. Australian, British, Chinese, Italian, Mexican)." };

  const data = await mealFetch<MealListResponse>(`/filter.php?a=${encodeURIComponent(area)}`);

  if (!data.meals) {
    return { area, count: 0, meals: [], message: `No meals found for area "${area}".` };
  }

  return {
    area,
    count: data.meals.length,
    meals: data.meals.map((m) => ({
      id: m.idMeal,
      name: m.strMeal,
      thumbnail: m.strMealThumb ?? null,
    })),
    tip: "Use get_meal_by_id with any id above to get full recipe details.",
  };
}

// ─── filter_meals_by_ingredient ───────────────────────────────────────────────

export async function filterMealsByIngredient(args: Record<string, unknown>): Promise<unknown> {
  const ingredient = String(args.ingredient ?? "").trim();
  if (!ingredient) return { error: "ingredient is required (e.g. chicken, garlic, tomato)." };

  const data = await mealFetch<MealListResponse>(`/filter.php?i=${encodeURIComponent(ingredient)}`);

  if (!data.meals) {
    return { ingredient, count: 0, meals: [], message: `No meals found with ingredient "${ingredient}".` };
  }

  return {
    ingredient,
    count: data.meals.length,
    meals: data.meals.map((m) => ({
      id: m.idMeal,
      name: m.strMeal,
      thumbnail: m.strMealThumb ?? null,
    })),
    tip: "Use get_meal_by_id with any id above to get full recipe details.",
  };
}
