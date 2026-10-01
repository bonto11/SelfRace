// src/app/features/strength/components/MuscleVolumeDeltaStrip.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { getMuscles, type MuscleKey } from "@/app/features/strength/constants/strengthMuscles";
import {
  apiGetMuscleVolume,
  type MuscleVolumeOverview,
} from "@/app/features/strength/api/strength_sessions";

export type DraftExerciseSets = { exercise_id: string; sets: number };

function fmt(v: number): string {
  return String(Number(v.toFixed(1)));
}

/**
 * 🌟 NOVÉ: živý dopad práve skladaného tréningu na týždenný objem.
 *
 * Základ (zapísané + naplánované) sa načíta raz pri otvorení formulára,
 * delta sa počíta lokálne z pridávaných cvikov - user vidí hneď, že
 * "prsia 7 → 10 z 12", bez ukladania a scrollovania späť.
 */
export default function MuscleVolumeDeltaStrip({
  draft,
}: {
  draft: DraftExerciseSets[];
}) {
  const t = useT();
  const { userId } = useUserId();
  const [base, setBase] = useState<MuscleVolumeOverview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetMuscleVolume(Number(userId), 4).then((res) => {
      if (alive) setBase(res);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const rows = useMemo(() => {
    if (!base) return [];

    const delta: Record<string, number> = {};
    for (const ex of draft) {
      const n = Number(ex.sets);
      if (!ex.exercise_id || !Number.isFinite(n) || n <= 0) continue;
      for (const [muscle, weight] of Object.entries(getMuscles(ex.exercise_id))) {
        delta[muscle] = (delta[muscle] ?? 0) + n * (weight ?? 0);
      }
    }

    return base.muscles
      .filter((m) => (delta[m.muscle] ?? 0) > 0)
      .map((m) => {
        const add = delta[m.muscle] ?? 0;
        const before = m.sets_projected;
        const after = before + add;
        return {
          muscle: m.muscle as MuscleKey,
          before,
          after,
          target: m.target,
          over: after > m.target * 1.3,
          reached: after >= m.target * 0.6 && after <= m.target * 1.3,
        };
      })
      .sort((a, b) => b.after - a.after);
  }, [base, draft]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 flex flex-col gap-1.5">
      <div className="text-[11px] font-semibold opacity-70">
        {t("muscleVolume.deltaTitle" as any)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rows.map((r) => {
          const color = r.over
            ? appColors.statusWarning
            : r.reached
              ? appColors.statusSuccess
              : appColors.textSecondary;
          return (
            <span key={r.muscle} className="text-[11px] tabular-nums">
              <span className="opacity-70">
                {t(`muscleVolume.muscles.${r.muscle}` as any)}{" "}
              </span>
              <span className="opacity-40">{fmt(r.before)} → </span>
              <span style={{ color, fontWeight: 600 }}>{fmt(r.after)}</span>
              <span className="opacity-40"> / {r.target}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}