// src/app/features/nutrition/api/nutrition.ts
// BE: Routes/nutrition.py. Chyba = Error(error_code) – UI ho prekladá cez nutrition.errors.<code>.

import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  BarcodeLookup,
  FoodEntry,
  FoodFavorite,
  FoodItem,
  FoodProduct,
  FoodProductValues,
  FoodSource,
  FoodTextDraft,
  Meal,
  MealSuggestion,
  NutritionDay,
  NutritionFuel,
  NutritionGoal,
  NutritionMode,
  NutritionProfileData,
  NutritionWeek,
  RecentFood,
} from "@/app/features/nutrition/types/nutrition";

type Res<T> = { success: true; data: T } | { success: false; error_code?: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const json = await callBackend<Res<T>>(`/nutrition${path}`, {
    cache: "no-store",
    ...init,
    // FormData (fotky) si hlavičku s boundary nastaví prehliadač sám
    headers:
      init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...(init.headers || {}) }
        : init.headers,
  });
  if (!json || json.success !== true) {
    throw new Error((json as any)?.error_code || "request_failed");
  }
  return json.data;
}

const u = (userId: number) => `/${encodeURIComponent(String(userId))}`;

/* ---------- profil ---------- */

export function apiGetNutritionProfile(userId: number) {
  return call<NutritionProfileData>(`${u(userId)}/profile`);
}

export type NutritionProfileInput = {
  goal: NutritionGoal;
  goal_rate_pct?: number | null;
  bmr_manual?: number | null;
  neat_factor?: number | null;
  protein_g_per_kg?: number | null;
  mode?: NutritionMode;
  /** zahodí kalibráciu výdaja z váhy (začne sa zbierať odznova) */
  reset_calibration?: boolean;
  /** súhlas so spracovaním údajov o strave – povinný pri prvom uložení */
  consent?: boolean;
};

export function apiSaveNutritionProfile(userId: number, input: NutritionProfileInput) {
  return call<NutritionProfileData>(`${u(userId)}/profile`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** odvolanie súhlasu – zmaže profil, zápisy aj obľúbené */
export function apiDeleteNutritionData(userId: number) {
  return call<Record<string, never>>(`${u(userId)}/profile`, { method: "DELETE" });
}

/* ---------- deň ---------- */

export function apiGetNutritionDay(userId: number, date: string) {
  return call<NutritionDay>(`${u(userId)}/day/${encodeURIComponent(date)}`);
}

/** „Deň mám zapísaný celý“ – ide do týždenného rozpočtu, kalibrácie a varovaní */
export function apiSetDayComplete(userId: number, date: string, complete: boolean) {
  return call<{ date: string; complete: boolean }>(`${u(userId)}/day/${encodeURIComponent(date)}/complete`, {
    method: "PUT",
    body: JSON.stringify({ complete }),
  });
}

/** palivo na dnes a ďalšie 2 dni (bez AI) */
export function apiNutritionFuel(userId: number) {
  return call<NutritionFuel>(`${u(userId)}/fuel`);
}

/* ---------- zápis jedla ---------- */

export type FoodLogInput = {
  date: string;
  meal: Meal;
  source: FoodSource;
  items: FoodItem[];
  ai_confidence?: number | null;
  raw_input?: string | null;
  /** produkt z čiarového kódu / etikety – vtedy presne jedna položka */
  product_id?: number | null;
};

export function apiAddFoodLog(userId: number, input: FoodLogInput) {
  return call<{ entries: FoodEntry[] }>(`${u(userId)}/log`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type FoodLogPatch = Partial<FoodItem> & { meal?: Meal; date?: string };

export function apiUpdateFoodLog(userId: number, entryId: number, patch: FoodLogPatch) {
  return call<{ entry: FoodEntry }>(`${u(userId)}/log/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function apiDeleteFoodLog(userId: number, entryId: number) {
  return call<Record<string, never>>(`${u(userId)}/log/${entryId}`, { method: "DELETE" });
}

/** „Ako včera“ – skopíruje jedlo z iného dňa */
export function apiCopyMeal(userId: number, input: { from_date: string; to_date: string; meal: Meal }) {
  return call<{ entries: FoodEntry[] }>(`${u(userId)}/log/copy`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiRecentFoods(userId: number) {
  return call<{ items: RecentFood[] }>(`${u(userId)}/recent`);
}

/* ---------- AI ---------- */

export function apiParseFoodText(userId: number, text: string) {
  return call<FoodTextDraft>(`${u(userId)}/parse-text`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

/** AI návrh jedál na zvyšok dňa – uložený na deň, nový len s force (účtuje sa) */
export function apiSuggestMeals(userId: number, date: string, force = false) {
  return call<{ suggestion: MealSuggestion; cached: boolean }>(`${u(userId)}/suggest`, {
    method: "POST",
    body: JSON.stringify({ date, force }),
  });
}

/* ---------- obľúbené ---------- */

export function apiFoodFavorites(userId: number) {
  return call<{ items: FoodFavorite[] }>(`${u(userId)}/favorites`);
}

export function apiAddFoodFavorite(userId: number, input: { name: string; meal?: Meal | null; items: FoodItem[] }) {
  return call<{ favorite: FoodFavorite }>(`${u(userId)}/favorites`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function apiDeleteFoodFavorite(userId: number, favId: number) {
  return call<Record<string, never>>(`${u(userId)}/favorites/${favId}`, { method: "DELETE" });
}

/* ---------- čiarový kód a produkty (fáza 2) ---------- */

export function apiLookupBarcode(userId: number, code: string) {
  return call<BarcodeLookup>(`${u(userId)}/barcode/${encodeURIComponent(code)}`);
}

export function apiSaveProduct(userId: number, product: FoodProductValues) {
  return call<{ product: FoodProduct }>(`${u(userId)}/products`, {
    method: "POST",
    body: JSON.stringify(product),
  });
}

/** fotka etikety (+ voliteľne predná strana obalu) → návrh produktu, nič sa neukladá */
export function apiParseLabel(userId: number, label: Blob, front?: Blob | null, barcode?: string | null) {
  const form = new FormData();
  form.append("label", label, "label.jpg");
  if (front) form.append("front", front, "front.jpg");
  if (barcode) form.append("barcode", barcode);
  return call<{ product: FoodProductValues }>(`${u(userId)}/parse-label`, { method: "POST", body: form });
}

/* ---------- fotka taniera a týždeň (fáza 3) ---------- */

export function apiParseFoodPhoto(userId: number, image: Blob, hint?: string) {
  const form = new FormData();
  form.append("image", image, "meal.jpg");
  if (hint) form.append("hint", hint);
  return call<FoodTextDraft>(`${u(userId)}/parse-photo`, { method: "POST", body: form });
}

export function apiNutritionWeek(userId: number, end?: string) {
  return call<NutritionWeek>(`${u(userId)}/week${end ? `?end=${encodeURIComponent(end)}` : ""}`);
}

