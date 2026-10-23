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
  protein_g_per_kg: number;
  consent_at: string | null;
  updated_at?: string | null;
};

export type NutritionBody = {
  sex: "M" | "F" | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
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
  bmr_source: "manual" | "formula";
  neat_factor: number;
  exercise_kcal: number;
  exercise_counted_kcal: number;
  tdee: number;
  goal: NutritionGoal;
  goal_rate_pct: number;
  day_load: DayLoad;
  carbs_g_per_kg: number;
  protein_g_per_kg: number;
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
