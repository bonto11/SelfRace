// src/app/features/strength/components/MuscleVolumeDeltaStrip.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { getMuscles, type MuscleKey } from "@/app/features/strength/constants/strengthMuscles";
import {
  apiGetMuscleVolume,
  type MuscleVolumeOverview,
} from "@/app/features/strength/api/strength_sessions";
import MuscleVolumeBar, {
  fmtSets,
  volumeColor,
} from "@/app/features/strength/components/MuscleVolumeBar";

export type DraftExerciseSets = { exercise_id: string; sets: number };

/**
 * Živý dopad práve skladaného tréningu na týždenný objem.
 *
 * Základ (zvyšok týždňa) sa načíta z BE - pri editácii zápisu sa ten zápis
 * zo základu vynechá cez excludeSessionId, inak by sa počítal dvakrát.
 *
 * kind: "planned" = plánuješ (prírastok sivý)
 *       "logged"  = zapisuješ odcvičené (prírastok farebný)
 */
export default function MuscleVolumeDeltaStrip({
  draft,
  kind = "planned",
  excludeSessionId,
}: {
  draft: DraftExerciseSets[];
  kind?: "planned" | "logged";
  excludeSessionId?: number | null;
}) {
  const t = useT();
  const { userId } = useUserId();
  const [base, setBase] = useState<MuscleVolumeOverview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetMuscleVolume(Number(userId), 4, excludeSessionId).then((res) => {
      if (alive) setBase(res);
    });
    return () => {
      alive = false;
    };
  }, [userId, excludeSessionId]);

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
      .map((m) => ({
        muscle: m.muscle as MuscleKey,
        done: m.sets_projected,
        added: delta[m.muscle] ?? 0,
        target: m.target,
      }))
      .sort((a, b) => b.done + b.added - (a.done + a.added));
  }, [base, draft]);

  if (rows.length === 0 || !base) return null;

  const scaleMax = base.scale_max || 22;

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 flex flex-col gap-2">
      <div className="text-[11px] font-semibold opacity-70">
        {t(
          (kind === "logged"
            ? "muscleVolume.deltaTitleLogged"
            : "muscleVolume.deltaTitle") as any,
        )}
      </div>

      {rows.map((r) => {
        const total = r.done + r.added;
        return (
          <div key={r.muscle} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] opacity-80">
                {t(`muscleVolume.muscles.${r.muscle}` as any)}
              </span>
              <span className="text-[11px] tabular-nums">
                <span className="opacity-40">{fmtSets(r.done)} → </span>
                <span style={{ color: volumeColor(total, r.target), fontWeight: 600 }}>
                  {fmtSets(total)}
                </span>
                <span className="opacity-40"> / {r.target}</span>
              </span>
            </div>
            <MuscleVolumeBar
              done={r.done}
              added={r.added}
              target={r.target}
              bands={base.bands}
              scaleMax={scaleMax}
              addedKind={kind}
            />
          </div>
        );
      })}

      <div className="text-[10px] opacity-50 leading-snug">
        {t(
          (kind === "logged"
            ? "muscleVolume.deltaHintLogged"
            : "muscleVolume.deltaHintPlanned") as any,
        )}
      </div>
    </div>
  );
}