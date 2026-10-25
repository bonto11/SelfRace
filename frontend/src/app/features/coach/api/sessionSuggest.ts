// src/app/features/coach/api/sessionSuggest.ts
// AI návrh jedného tréningu (advisor, formulár „Pridať tréning“).
// Návrh sa neukladá – je to stav formulára, user ho uloží sám.

import { callBackend } from "@/app/shared/utils/callBackend";
import type { SessionTemplateData } from "@/app/features/coach/constants/sessionTemplates";

/** Jedno kolo konverzácie – posiela sa späť pri úprave návrhu. */
export type SuggestThreadEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; reply_text: string; session: SessionTemplateData };

export type SessionSuggestion = {
  reply_text: string;
  warning: string | null;
  session: SessionTemplateData;
  rounds_left: number;
};

type Res =
  | { success: true; data: SessionSuggestion }
  | { success: false; error_code?: string };

/** Vyhodí Error s error_code (preklad v advisorDaily.suggest.errors.<code>). */
export async function apiSuggestSession(
  userId: number,
  body: { plan_date: string; request: string | null; thread: SuggestThreadEntry[] },
): Promise<SessionSuggestion> {
  const json = await callBackend<Res>(`/session-suggest/${encodeURIComponent(String(userId))}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!json || json.success !== true) {
    throw new Error((json as any)?.error_code || "ai_generation_failed");
  }
  return json.data;
}
