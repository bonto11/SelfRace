// src/app/features/coach/api/advisor_review.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/** Odporúčanie na ďalší týždeň. Staré hodnotenia majú len text (string). */
export type AdvisorSuggestion =
  | string
  | {
      text: string;
      /** add = pridať tréning (len tu je gombík), avoid = zákaz, info = kontext */
      action?: "add" | "avoid" | "info" | null;
      /** id šablóny pre ManualSessionForm ("b:easy_run" / "u:<uuid>") */
      template_id?: string | null;
      duration_min?: number | null;
    };

export type AdvisorReviewContent = {
  headline?: string | null;
  last_week?: {
    assessment?: string | null;
    went_well?: string[] | null;
    to_improve?: string[] | null;
  } | null;
  upcoming_check?: string[] | null;
  next_week_guidance?: {
    summary?: string | null;
    suggested_structure?: AdvisorSuggestion[] | null;
  } | null;
  health_warning?: string | null;
  /** previous_week = hodnotí minulý týždeň a radí na aktuálny (po-st) */
  review_mode?: "previous_week" | "current_week" | null;
  plan_week_start?: string | null;
  generated_at?: string | null;
  model?: string | null;
};

export type AdvisorReviewRow = {
  id: number;
  week_start: string;
  model: string | null;
  created_at: string;
  review: AdvisorReviewContent;
};

export type GenerateAdvisorReviewResult = {
  success: boolean;
  error_code?: string | null;
  message?: string | null;
  review?: AdvisorReviewContent | null;
  week_start?: string | null;
  from_cache?: boolean;
};

const base = (userId: number) => `/advisor-review`;

/**
 * Posledné hodnotenie týždňa. Chýbajúce hodnotenie nie je chyba -
 * vráti sa null.
 */
export async function apiGetLatestAdvisorReview(
  userId: number,
): Promise<AdvisorReviewRow | null> {
  if (!userId) return null;
  try {
    const json = await callBackend<any>(
      `${base(userId)}/latest/${encodeURIComponent(String(userId))}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success ? ((json.data as AdvisorReviewRow) ?? null) : null;
  } catch (e) {
    console.error("[AdvisorReview] latest error", e);
    return null;
  }
}

/**
 * "Skontroluj mi týždeň". Spolu s nedeľným cronom jediné miesto,
 * kde hodnotenie vzniká.
 */
export async function apiGenerateAdvisorReview(
  userId: number,
): Promise<GenerateAdvisorReviewResult> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  try {
    const json = await callBackend<any>(
      `${base(userId)}/generate/${encodeURIComponent(String(userId))}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({}),
      },
    );
    return {
      success: !!json?.success,
      error_code: json?.error_code ?? null,
      message: json?.message ?? null,
      review: json?.data?.review ?? null,
      week_start: json?.data?.week_start ?? null,
      from_cache: !!json?.data?.from_cache,
    };
  } catch (e) {
    console.error("[AdvisorReview] generate error", e);
    return { success: false, error_code: "REQUEST_FAILED", message: null };
  }
}