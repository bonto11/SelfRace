// src/app/features/nutrition/types/nutrition.ts
// Zrkadlo odpovedí BE Routes/nutrition.py (Services/nutrition.py, nutrition_targets.py).

export type NutritionGoal = "lose" | "maintain" | "gain";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type DayLoad = "rest" | "easy" | "moderate" | "hard";
export type FoodSource = "manual" | "text" | "favorite" | "recent" | "barcode" | "label" | "photo";
export type BodyField = "weight_kg" | "birth_date" | "height_cm" | "sex";

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export type NutritionProfile = {
  goal: NutritionGoal;
  goal_rate_pct: number | null;
  bmr_manual: number | null;
  neat_factor: number;
  /** null = automaticky podľa cieľa */
  protein_g_per_kg: number | null;
  consent_at: string | null;
  updated_at?: string | null;
};

export type NutritionBody = {
  sex: "M" | "F" | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  /** BMR z body scanu (InBody), ak nie je starší ako 180 dní */
  bmr_measured?: { kcal: number; date: string } | null;
  /** BMR zo vzorca – len ukážka v nastaveniach (bez ručného a scanu) */
  bmr_formula?: number | null;
};

export type NutritionProfileData = {
  profile: NutritionProfile | null;
  body: NutritionBody;
  missing: BodyField[];
};

export type Macros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/** jedna položka jedla – návrh od AI, obľúbené, nedávne, ručný zápis */
export type FoodItem = Macros & {
  name: string;
  grams: number | null;
};

export type FoodEntry = FoodItem & {
  id: number;
  date: string;
  meal: Meal;
  source: FoodSource;
  ai_confidence: number | null;
  created_at?: string;
};

export type ExerciseItem = {
  source: "activity" | "strength_log" | "plan" | "external";
  id: number | string | null;
  title: string | null;
  sport: string;
  minutes: number;
  kcal: number;
  estimated: boolean;
  load: string | null;
  event?: boolean;
};

export type TargetsLimit = "min_bmr" | "max_loss_rate" | "minor_maintain" | "low_bmi_maintain" | "carbs_reduced";

export type TargetsBreakdown = {
  bmr: number;
  bmr_source: "manual" | "measured" | "formula";
  bmr_measured_at?: string | null;
  neat_factor: number;
  exercise_kcal: number;
  exercise_counted_kcal: number;
  tdee: number;
  goal: NutritionGoal;
  goal_rate_pct: number;
  day_load: DayLoad;
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
  /** bielkoviny automaticky podľa cieľa (user si nevybral vlastné) */
  protein_auto?: boolean;
  weight_kg: number;
  age: number;
  limits: TargetsLimit[];
};

export type NutritionDay = {
  date: string;
  profile: NutritionProfile | null;
  missing: BodyField[];
  entries?: FoodEntry[];
  eaten?: Macros;
  targets: Macros | null;
  breakdown?: TargetsBreakdown | null;
  exercise?: ExerciseItem[];
};

export type FoodTextDraft = {
  items: FoodItem[];
  confidence: number | null;
  note: string | null;
  raw_input: string;
};

export type FoodFavorite = Macros & {
  id: number;
  name: string;
  meal: Meal | null;
  items: FoodItem[];
};

export type RecentFood = FoodItem & { meal: Meal | null };

/* ---------- fáza 2: produkty (hodnoty na 100 g) ---------- */

export type ProductSource = "off" | "label_ai" | "user";

export type FoodProductValues = {
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  fiber_100g: number | null;
  sugar_100g: number | null;
  salt_100g: number | null;
  serving_g: number | null;
  source: ProductSource;
};

export type FoodProduct = FoodProductValues & {
  id: number;
  /** vlastný produkt usera (z etikety / ručne), nie OFF */
  own: boolean;
};

export type BarcodeLookup = {
  barcode: string;
  found: boolean;
  product?: FoodProduct;
  /** Open Food Facts neodpovedal – nie je to „nenájdené“ */
  off_error?: boolean;
};

/* ---------- fáza 3: týždeň ---------- */

export type NutritionWeekDay = {
  date: string;
  logged: boolean;
  eaten: Macros;
  targets: Macros | null;
  day_load: DayLoad | null;
};

export type NutritionWeekSummary = {
  logged_days: number;
  avg_kcal?: number;
  avg_target_kcal?: number;
  avg_protein_g?: number;
  avg_target_protein_g?: number;
  kcal_pct?: number | null;
  protein_pct?: number | null;
  hard_days?: { date: string; carbs_g: number; target_carbs_g: number; carbs_pct: number | null }[];
};

export type NutritionWeek = {
  profile: boolean;
  goal?: NutritionGoal;
  missing?: BodyField[];
  days: NutritionWeekDay[];
  summary: NutritionWeekSummary;
};
