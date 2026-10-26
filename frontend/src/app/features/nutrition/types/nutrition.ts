// src/app/features/nutrition/types/nutrition.ts
// Zrkadlo odpovedí BE Routes/nutrition.py (Services/nutrition.py, nutrition_targets.py).

export type NutritionGoal = "lose" | "maintain" | "gain";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
/** load = sacharidové doplnenie pred pretekom, race = deň pretekov */
export type DayLoad = "rest" | "easy" | "moderate" | "hard" | "load" | "race";
export type FoodSource =
  | "manual"
  | "text"
  | "favorite"
  | "recent"
  | "barcode"
  | "label"
  | "photo"
  | "suggestion"
  | "copy";
/** macros = čísla, simple = tanier a porcie bez počítania */
export type NutritionMode = "macros" | "simple";
export type BodyField = "weight_kg" | "birth_date" | "height_cm" | "sex";

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export type NutritionProfile = {
  goal: NutritionGoal;
  goal_rate_pct: number | null;
  bmr_manual: number | null;
  neat_factor: number;
  /** null = automaticky podľa cieľa */
  protein_g_per_kg: number | null;
  mode: NutritionMode;
  /** kalibrácia výdaja z váhy (null = bez kalibrácie) */
  tdee_factor: number | null;
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
  source: "activity" | "strength_log" | "plan" | "external" | "race";
  id: number | string | null;
  title: string | null;
  sport: string;
  minutes: number;
  kcal: number;
  estimated: boolean;
  load: string | null;
  event?: boolean;
};

export type TargetsLimit =
  | "min_bmr"
  | "max_loss_rate"
  | "minor_maintain"
  | "low_bmi_maintain"
  | "carbs_reduced"
  | "race_fueling"
  | "hard_day_deficit";

/** pretek dňa alebo doplnenie sacharidov pred ním (coach prefs) */
export type RaceInfo = {
  kind: "race" | "load";
  days_to: number;
  date: string;
  name: string | null;
  km: number | null;
  minutes: number | null;
  minutes_estimated: boolean;
  race_type: string | null;
  long: boolean;
};

export type TargetsBreakdown = {
  bmr: number;
  bmr_source: "manual" | "measured" | "formula";
  bmr_measured_at?: string | null;
  neat_factor: number;
  exercise_kcal: number;
  exercise_counted_kcal: number;
  tdee: number;
  /** výdaj podľa modelu pred kalibráciou */
  tdee_model?: number;
  tdee_factor?: number;
  /** úprava z týždenného rozpočtu (kcal), len dnes a ďalej v týždni */
  budget_adjust_kcal?: number;
  goal: NutritionGoal;
  goal_rate_pct: number;
  day_load: DayLoad;
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
  /** bielkoviny automaticky podľa cieľa (user si nevybral vlastné) */
  protein_auto?: boolean;
  weight_kg: number;
  ref_weight_kg?: number;
  age: number;
  limits: TargetsLimit[];
  race?: RaceInfo | null;
};

export type WeekBudget = {
  week_from: string;
  week_to: string;
  week_target_kcal: number;
  /** + = minulé dni týždňa pod cieľom, − = nad cieľom */
  diff_kcal: number;
  counted_days: number;
  adjust_pct: number;
  adjust_kcal: number;
};

export type Calibration = {
  status: "collecting" | "ok";
  factor: number;
  at: string | null;
  window_from: string;
  window_to: string;
  complete_days: number;
  weighins: number;
  span_days: number;
  need_complete_days: number;
  need_weighins: number;
  need_span_days: number;
  raw_factor?: number;
  clamped?: boolean;
  avg_intake_kcal?: number;
  model_tdee_kcal?: number;
  real_tdee_kcal?: number;
  kg_per_week?: number;
};

export type RepeatOption = { date: string; count: number; kcal: number; names: string[] };

export type SuggestedMeal = {
  meal: Meal;
  title: string | null;
  why: string | null;
  items: FoodItem[];
  totals: Macros;
};

export type MealSuggestion = {
  meals: SuggestedMeal[];
  note: string | null;
  remaining: Macros;
  totals: Macros;
  created_at: string;
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
  /** user označil deň ako zapísaný celý */
  complete?: boolean;
  suggestion?: MealSuggestion | null;
  /** „Ako včera“ – jedlá dňa bez zápisu, ktoré boli v posledných dňoch */
  repeat_options?: Partial<Record<Meal, RepeatOption>>;
  calibration?: Calibration | null;
  budget?: WeekBudget | null;
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
  complete?: boolean;
  /** celý deň (zaškrtnutý alebo raňajky, obed aj večera) */
  full?: boolean;
  eaten: Macros;
  targets: Macros | null;
  day_load: DayLoad | null;
};

export type NutritionWeekSummary = {
  logged_days: number;
  full_days?: number;
  avg_kcal?: number;
  avg_target_kcal?: number;
  avg_protein_g?: number;
  avg_target_protein_g?: number;
  kcal_pct?: number | null;
  protein_pct?: number | null;
  hard_days?: { date: string; carbs_g: number; target_carbs_g: number; carbs_pct: number | null }[];
};

export type NutritionWarnings = {
  /** dlhodobo pod cieľom (riziko RED-S) */
  underfuel?: { kcal_pct: number; days: number };
  low_carb_hard_days?: { date: string; carbs_pct: number }[];
  fast_loss?: { pct_per_week: number; kg_per_week: number };
};

export type NutritionWeek = {
  profile: boolean;
  goal?: NutritionGoal;
  mode?: NutritionMode;
  missing?: BodyField[];
  days: NutritionWeekDay[];
  summary: NutritionWeekSummary;
  warnings?: NutritionWarnings;
};

/* ---------- fáza 4: palivo na dnes a ďalšie dni ---------- */

export type FuelTipKind =
  | "rest"
  | "easy"
  | "pre"
  | "during"
  | "post"
  | "evening_before"
  | "loading"
  | "race_breakfast"
  | "race_during"
  | "race_short"
  | "race_after"
  | "no_deficit"
  | "soft_deficit";

export type FuelTip = {
  kind: FuelTipKind;
  carbs_g?: number | null;
  protein_g?: number;
  carbs_g_per_kg?: number;
  carbs_g_per_h?: number;
  fluid_ml_per_h?: number;
  hours?: number;
  total_carbs_g?: number;
  title?: string | null;
  race_name?: string | null;
  days_to?: number;
  next?: "race" | "hard";
};

export type FuelSession = {
  title: string | null;
  sport: string;
  minutes: number;
  load: string | null;
  source: ExerciseItem["source"];
  event: boolean;
};

export type FuelDay = {
  date: string;
  day_load: DayLoad | null;
  targets: Macros | null;
  sessions: FuelSession[];
  race: RaceInfo | null;
  tips: FuelTip[];
};

export type NutritionFuel = {
  profile: boolean;
  mode?: NutritionMode;
  missing?: BodyField[];
  days: FuelDay[];
};
