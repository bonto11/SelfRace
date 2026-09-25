// src/app/shared/components/session/SectionStrengthSummary.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import { getExerciseMeta } from "@/app/shared/constants/strengthMeta";
import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";
import {
  apiGetStrengthSessionByActivity,
  type StrengthSession,
} from "@/app/features/activities/api/strength_sessions";
import {
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
} from "@/app/shared/ui/tokens";

/**
 * 🌟 NOVÉ: čo sa v tejto (silovej) aktivite reálne odcvičilo.
 *
 * Zdrojom je zápis zo strength_sessions naviazaný na activity_id - väzbu
 * vytvára sync pri importe Strava aktivity. Ak zápis neexistuje, sekcia sa
 * nevykreslí (ActivitySectionShell vráti null pri prázdnom obsahu).
 *
 * Objem sa ráta len z cvikov meraných na opakovania a len z pracovných sérií -
 * pri planku je "reps" počet sekúnd, to by objem skreslilo.
 */
export default function SectionStrengthSummary({ activityId }: { activityId: number }) {
  const t = useT();
  const { userId } = useUserId();
  const lang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const [session, setSession] = useState<StrengthSession | null>(null);

  useEffect(() => {
    if (!userId || !activityId) return;
    let alive = true;
    apiGetStrengthSessionByActivity(Number(userId), Number(activityId)).then((s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
    };
  }, [userId, activityId]);

  const stats = useMemo(() => {
    const exercises = session?.log?.exercises ?? [];
    if (!exercises.length) return null;

    let volume = 0;
    let workSets = 0;
    let topWeight = 0;
    let topWeightExercise: string | null = null;
    let topWeightReps: number | null = null;

    const rows: Array<{ id: string; sets: number; best: string }> = [];

    for (const ex of exercises) {
      const measure = getExerciseMeta(ex.exercise_id).measure;
      const work = (ex.sets ?? []).filter((s) => !s.is_warmup && (s.reps || s.weight_kg));
      if (!work.length) continue;
      workSets += work.length;

      if (measure === "reps") {
        for (const s of work) {
          if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps;
          if (s.weight_kg && s.weight_kg > topWeight) {
            topWeight = s.weight_kg;
            topWeightExercise = ex.exercise_id;
            topWeightReps = s.reps ?? null;
          }
        }
      }

      const bestSet = work.reduce((a, b) => ((b.weight_kg ?? 0) > (a.weight_kg ?? 0) ? b : a));
      const unit = measure === "time" ? "s" : measure === "distance" ? "m" : "";
      const best =
        bestSet.weight_kg && bestSet.reps
          ? `${bestSet.weight_kg} kg × ${bestSet.reps}${unit}`
          : bestSet.reps
            ? `${bestSet.reps}${unit || ` ${t("sessions.detail.unitReps") || "opak."}`}`
            : "—";
      rows.push({ id: ex.exercise_id, sets: work.length, best });
    }

    if (!rows.length) return null;

    return {
      volume: Math.round(volume),
      workSets,
      exerciseCount: rows.length,
      topWeight,
      topWeightExercise,
      topWeightReps,
      rows,
      note: session?.session_note ?? null,
    };
  }, [session, t]);

  if (!stats) return null;

  const name = (id: string) =>
    STRENGTH_CATALOG_FE[id]?.[lang] ?? id.replace(/_/g, " ");

  const items = [
    { label: t("strengthLog.totalVolume"), value: stats.volume > 0 ? `${stats.volume} kg` : "—" },
    { label: t("strengthLog.setsLogged"), value: stats.workSets },
    { label: t("sessions.detail.sectionExercises"), value: stats.exerciseCount },
    {
      label: t("strengthLog.topSet"),
      value:
        stats.topWeight > 0
          ? `${stats.topWeight} kg${stats.topWeightReps ? ` × ${stats.topWeightReps}` : ""}`
          : "—",
    },
  ];

  return (
    <ActivitySectionShell
      title={t("strengthLog.activitySummaryTitle")}
      defaultOpen={true}
      items={items}
    >
      <ul className={PLAN_EX_LIST}>
        {stats.rows.map((r) => (
          <li key={r.id} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
            <div className={PLAN_EX_NAME} style={{ textTransform: "capitalize", fontWeight: 600 }}>
              {name(r.id)}
            </div>
            <div className={PLAN_EX_LINE}>
              {r.sets} {t("strengthLog.setsLogged")} · {t("strengthLog.bestSet")}: {r.best}
            </div>
          </li>
        ))}
      </ul>

      {stats.note && (
        <div className="mt-3 text-sm text-white/70 leading-relaxed">{stats.note}</div>
      )}
    </ActivitySectionShell>
  );
}