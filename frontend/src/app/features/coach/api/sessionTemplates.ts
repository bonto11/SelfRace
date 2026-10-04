// src/app/features/coach/api/sessionTemplates.ts
// Vlastné šablóny tréningov usera.
//
// PREČO users_preferences a nie vlastná tabuľka: ide o pár desiatok malých
// JSONov na usera, ktoré sa vždy čítajú naraz. Existujúca tabuľka má RLS aj
// API, netreba migráciu. Do AI ide len kľúč coach.prefs, takže šablóny AI
// kontext nezaťažia.

import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import {
  MAX_USER_TEMPLATES,
  USER_TEMPLATES_PREF_KEY,
  type SessionTemplateData,
  type UserSessionTemplate,
} from "@/app/features/coach/constants/sessionTemplates";

function normalize(raw: any): UserSessionTemplate[] {
  const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  return items.filter(
    (x: any) => x && typeof x.id === "string" && typeof x.name === "string" && x.data?.sport,
  );
}

export async function apiListUserTemplates(userId: number): Promise<UserSessionTemplate[]> {
  if (!userId) return [];
  try {
    return normalize(await apiFetchUserPref(userId, USER_TEMPLATES_PREF_KEY));
  } catch (e) {
    console.error("[SessionTemplates] list error", e);
    return [];
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      // ignore
    }
  }
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Uloží novú šablónu. Vracia nový zoznam. Pri plnom zozname hodí "limit". */
export async function apiSaveUserTemplate(
  userId: number,
  name: string,
  data: SessionTemplateData,
): Promise<UserSessionTemplate[]> {
  // vždy čerstvý stav z DB - šablónu mohol pridať aj iný otvorený tab / zariadenie
  const current = await apiListUserTemplates(userId);
  if (current.length >= MAX_USER_TEMPLATES) {
    throw new Error("advisorDaily.templates.limit");
  }
  const next: UserSessionTemplate[] = [
    ...current,
    { id: makeId(), name: name.trim(), created_at: new Date().toISOString(), data },
  ];
  await apiUpsertUserPref(userId, USER_TEMPLATES_PREF_KEY, { v: 1, items: next });
  return next;
}

export async function apiDeleteUserTemplate(
  userId: number,
  templateId: string,
): Promise<UserSessionTemplate[]> {
  const current = await apiListUserTemplates(userId);
  const next = current.filter((x) => x.id !== templateId);
  await apiUpsertUserPref(userId, USER_TEMPLATES_PREF_KEY, { v: 1, items: next });
  return next;
}
