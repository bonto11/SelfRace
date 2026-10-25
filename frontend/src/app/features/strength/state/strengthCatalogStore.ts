// src/app/features/strength/state/strengthCatalogStore.ts
"use client";

/**
 * Katalóg cvikov z DB (BE `GET /strength-catalog`).
 *
 * PREČO na mieste: názvy, meta, partie a kategórie cvikov číta ~15 súborov
 * priamo z konštánt (STRENGTH_CATALOG_FE, STRENGTH_META, EXERCISE_MUSCLES,
 * CATEGORY_IDS). Store ich naplní dátami z DB – komponenty ostanú bez zmeny
 * a nový cvik z admin panelu je v appke bez deployu.
 *
 * Rýchlosť: katalóg (~40 kB) je v localStorage a použije sa hneď pri načítaní
 * modulu. BE sa pýta len na verziu – celý katalóg pošle, až keď sa zmenil.
 * Konštanty v kóde sú záloha pre prvé spustenie a výpadok BE.
 */

import { useSyncExternalStore } from "react";
import { callBackend } from "@/app/shared/utils/callBackend";
import {
  INACTIVE_EXERCISES,
  STRENGTH_CATALOG_FE,
  type ExerciseLangMap,
} from "@/app/features/strength/constants/strengthCatalog";
import {
  STRENGTH_META,
  type ExerciseLoadMode,
  type ExerciseMeasure,
} from "@/app/features/strength/constants/strengthMeta";
import { EXERCISE_MUSCLES, type MuscleKey } from "@/app/features/strength/constants/strengthMuscles";
import { CATEGORY_IDS, type ExerciseCategory } from "@/app/features/strength/constants/strengthCategories";

export type CatalogItem = {
  id: string;
  names: Partial<ExerciseLangMap>;
  measure: ExerciseMeasure;
  load_mode: ExerciseLoadMode;
  muscles: Partial<Record<MuscleKey, number>>;
  categories: ExerciseCategory[];
  active: boolean;
};

type Stored = { version: string; items: CatalogItem[] };

const STORAGE_KEY = "sr:strength-catalog:v1";

let version: string | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function apply(items: CatalogItem[]) {
  if (!Array.isArray(items) || !items.length) return;
  for (const k of Object.keys(STRENGTH_CATALOG_FE)) delete STRENGTH_CATALOG_FE[k];
  for (const k of Object.keys(STRENGTH_META)) delete STRENGTH_META[k];
  for (const k of Object.keys(EXERCISE_MUSCLES)) delete EXERCISE_MUSCLES[k];
  CATEGORY_IDS.plyo.length = 0;
  CATEGORY_IDS.iso.length = 0;
  INACTIVE_EXERCISES.clear();

  for (const it of items) {
    if (!it?.id) continue;
    const en = it.names?.en || it.id;
    STRENGTH_CATALOG_FE[it.id] = { en, sk: it.names?.sk || en, cs: it.names?.cs || it.names?.sk || en };
    STRENGTH_META[it.id] = { measure: it.measure || "reps", load_mode: it.load_mode || "external" };
    EXERCISE_MUSCLES[it.id] = { ...(it.muscles || {}) };
    for (const c of it.categories || []) if (CATEGORY_IDS[c]) CATEGORY_IDS[c].push(it.id);
    if (it.active === false) INACTIVE_EXERCISES.add(it.id);
  }
  revision += 1;
  listeners.forEach((l) => l());
}

// hneď pri načítaní modulu – prvý render už má katalóg z DB
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Stored;
      if (stored?.version && Array.isArray(stored.items)) {
        apply(stored.items);
        version = stored.version;
      }
    }
  } catch {
    // poškodená alebo nedostupná cache – ostane zabudovaný katalóg
  }
}

let syncing: Promise<void> | null = null;

/** Overí verziu na BE a pri zmene stiahne katalóg. Raz za štart appky stačí. */
export function syncStrengthCatalog(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const q = version ? `?v=${encodeURIComponent(version)}` : "";
      const json = await callBackend<{
        success: boolean;
        data?: { version: string; source: string; items: CatalogItem[] | null };
      }>(`/strength-catalog${q}`, { cache: "no-store" });
      const data = json?.success ? json.data : null;
      if (!data || data.source !== "db" || !data.items?.length) return;
      apply(data.items);
      version = data.version;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: data.version, items: data.items }));
      } catch {
        // plný localStorage – katalóg platí aspoň do zatvorenia appky
      }
    } catch {
      // BE nedostupný – ostáva katalóg z cache alebo z kódu
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Číslo, ktoré sa zmení po načítaní nového katalógu – na prepočet zoznamov cvikov. */
export function useStrengthCatalogRevision(): number {
  return useSyncExternalStore(subscribe, () => revision, () => 0);
}
