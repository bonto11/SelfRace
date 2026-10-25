// src/app/features/coach/api/seasonPlan.ts
// Plán obdobia – kostra na viac týždňov (advisor). AI ju navrhne, user ju
// uloží a upravuje; tréningy po dňoch si skladá sám.

import { callBackend } from "@/app/shared/utils/callBackend";

export type SeasonWeekLoad = "recovery" | "easy" | "moderate" | "hard";

export type SeasonWeek = {
  index: number;
  start_date: string;
  theme: string;
  focus: string | null;
  load: SeasonWeekLoad;
  run_sessions: number | null;
  run_minutes: number | null;
  strength_sessions: number | null;
  strength_focus: string | null;
  key_sessions: string[];
  /** vlastná poznámka usera – AI ju neprepisuje */
  notes: string | null;
};

export type SeasonPlan = {
  v: 1;
  title: string;
  goal_summary: string | null;
  principles: string[];
  request: string | null;
  start_date: string;
  end_date: string;
  weeks: SeasonWeek[];
  created_at?: string;
  updated_at?: string;
};

export type SeasonThreadEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; reply_text: string };

export type SeasonSuggestion = {
  reply_text: string;
  plan: SeasonPlan;
  rounds_left: number;
};

const base = (userId: number) => `/season-plan/${encodeURIComponent(String(userId))}`;

type Res<T> = { success: true; data: T } | { success: false; error_code?: string };

function unwrap<T>(json: Res<T> | null | undefined, fallback: string): T {
  if (!json || json.success !== true) throw new Error((json as any)?.error_code || fallback);
  return json.data;
}

export async function apiGetSeasonPlan(userId: number): Promise<SeasonPlan | null> {
  const json = await callBackend<Res<{ plan: SeasonPlan | null }>>(base(userId), { cache: "no-store" });
  return unwrap(json, "load_failed").plan ?? null;
}

/** Vyhodí Error s error_code (preklad v seasonPlan.errors.<code>). */
export async function apiSuggestSeasonPlan(
  userId: number,
  body: {
    start_date: string;
    weeks: number;
    request: string;
    thread: SeasonThreadEntry[];
    current_plan: SeasonPlan | null;
  },
): Promise<SeasonSuggestion> {
  const json = await callBackend<Res<SeasonSuggestion>>(`${base(userId)}/suggest`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap(json, "ai_generation_failed");
}

export async function apiSaveSeasonPlan(userId: number, plan: SeasonPlan): Promise<SeasonPlan> {
  const json = await callBackend<Res<{ plan: SeasonPlan }>>(base(userId), {
    method: "PUT",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  return unwrap(json, "save_failed").plan;
}

export async function apiDeleteSeasonPlan(userId: number): Promise<void> {
  const json = await callBackend<Res<unknown>>(base(userId), { method: "DELETE", cache: "no-store" });
  if (!json || (json as any).success !== true) throw new Error((json as any)?.error_code || "save_failed");
}

/** Týždeň kostry, do ktorého padne deň (YYYY-MM-DD). */
export function seasonWeekFor(plan: SeasonPlan | null | undefined, isoDay: string): SeasonWeek | null {
  if (!plan) return null;
  for (const w of plan.weeks) {
    const start = w.start_date;
    const end = new Date(`${start}T00:00:00`);
    end.setDate(end.getDate() + 6);
    const p = (n: number) => String(n).padStart(2, "0");
    const endIso = `${end.getFullYear()}-${p(end.getMonth() + 1)}-${p(end.getDate())}`;
    if (isoDay >= start && isoDay <= endIso) return w;
  }
  return null;
}
