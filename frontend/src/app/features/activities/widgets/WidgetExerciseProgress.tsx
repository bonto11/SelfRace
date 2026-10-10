"use client";

import { useEffect, useMemo, useState } from "react";
import { Dumbbell, TrendingUp } from "lucide-react";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Button from "@/app/shared/ui/components/Button";
import SelectFieldFilter from "@/app/shared/ui/components/SelectFieldFilter";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { appLocale, normalizeLang } from "@/app/shared/i18n/locale";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Hero,
  IconTile,
  Pill,
  Sparkline,
  WidgetEmpty,
  WidgetLoading,
} from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";
import { STRENGTH_CATALOG_FE } from "@/app/features/strength/constants/strengthCatalog";
import { getExerciseMeta } from "@/app/features/strength/constants/strengthMeta";
import type { ExerciseProgressionEntry } from "@/app/features/strength/api/strength_sessions";

type Mode = "weight" | "reps";
type Saved = { exerciseId?: string; mode?: Mode };

// výber cviku a režimu si pamätá zariadenie (per user) – nie je to dôležitý stav
const lsKey = (userId: number) => `sr:ex-progress:v1:${userId}`;

function readSaved(userId: number | null): Saved {
  if (!userId) return {};
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function writeSaved(userId: number | null, v: Saved) {
  if (!userId) return;
  try {
    window.localStorage.setItem(lsKey(userId), JSON.stringify(v));
  } catch {
    /* súkromné okno */
  }
}

const NO_HISTORY: ExerciseProgressionEntry[] = [];

/**
 * Progres jedného cviku: top váha alebo najviac opakovaní za každý tréning.
 * Cviky na výber sú z posledných zápisov (najčastejšie hore), história
 * cviku ide z BE za pol roka (zdroj exerciseProgress v provideri).
 */
export default function WidgetExerciseProgress() {
  const t = useT();
  const { lang: appLang } = useSettings();
  const lang = normalizeLang(appLang) ?? "en";
  const { userId } = useUserId();
  const { strengthSessions, exerciseProgress, progressExerciseId, setProgressExerciseId } = useActivityData();
  useEnsure(strengthSessions, exerciseProgress);

  const [saved, setSaved] = useState<Saved>({});
  useEffect(() => setSaved(readSaved(userId)), [userId]);
  const save = (patch: Saved) => {
    const next = { ...saved, ...patch };
    setSaved(next);
    writeSaved(userId, next);
  };

  // cviky s odcvičenou sériou z posledných zápisov, najčastejšie hore
  const options = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of strengthSessions.data ?? []) {
      for (const ex of s.log?.exercises ?? []) {
        if (!ex.exercise_id) continue;
        if (!(ex.sets ?? []).some((x) => !x.is_warmup && !!x.reps)) continue;
        count.set(ex.exercise_id, (count.get(ex.exercise_id) ?? 0) + 1);
      }
    }
    const name = (id: string) =>
      STRENGTH_CATALOG_FE[id]?.[lang as "sk" | "cs" | "en"] ?? id.replace(/_/g, " ");
    return Array.from(count.entries())
      .sort((a, b) => b[1] - a[1] || name(a[0]).localeCompare(name(b[0])))
      .map(([id]) => ({ value: id, label: name(id) }));
  }, [strengthSessions.data, lang]);

  const selected =
    saved.exerciseId && options.some((o) => o.value === saved.exerciseId)
      ? saved.exerciseId
      : options[0]?.value ?? null;

  useEffect(() => {
    if (selected !== progressExerciseId) setProgressExerciseId(selected);
  }, [selected, progressExerciseId, setProgressExerciseId]);

  const history = selected && progressExerciseId === selected ? exerciseProgress.data ?? NO_HISTORY : NO_HISTORY;
  const loading = !strengthSessions.loaded || (!!selected && (progressExerciseId !== selected || !exerciseProgress.loaded));

  // cvik s vlastnou váhou nemá čo ukázať vo „Váhe“ – ide rovno na opakovania
  const hasWeight = history.some((h) => (h.top_weight_kg ?? 0) > 0);
  const mode: Mode = hasWeight ? saved.mode ?? "weight" : "reps";

  const measure = selected ? getExerciseMeta(selected).measure : "reps";
  const unit =
    mode === "weight"
      ? "kg"
      : measure === "time"
        ? "s"
        : measure === "distance"
          ? "m"
          : t("exerciseProgress.repsUnit");

  const points = useMemo(
    () =>
      history
        .map((h) => ({
          date: h.date,
          value: mode === "weight" ? Number(h.top_weight_kg ?? 0) : Number(h.max_reps ?? h.top_reps ?? 0),
        }))
        .filter((p) => p.value > 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [history, mode],
  );

  const num = (v: number) => v.toLocaleString(appLocale(), { maximumFractionDigits: 1 });
  const first = points[0];
  const last = points[points.length - 1];
  const delta = first && last ? last.value - first.value : 0;
  const weeks =
    first && last
      ? Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / (7 * 86400000)))
      : 0;

  const stop = (e: any) => e?.stopPropagation?.();

  return (
    <WidgetCard
      title={t("exerciseProgress.title")}
      tooltip={activityInfo(t, "exerciseProgress")}
      accent="none"
      minH={200}
    >
      {!strengthSessions.loaded ? (
        <WidgetLoading />
      ) : !options.length ? (
        <WidgetEmpty icon={Dumbbell} text={t("exerciseProgress.empty")} />
      ) : (
        <div className={WK.stack}>
          <div onClick={stop}>
            <SelectFieldFilter
              searchPlaceholder={t("strengthLog.searchExercise")}
              emptyLabel={t("strengthLog.noMatch")}
              value={selected ?? ""}
              onValueChange={(v) => save({ exerciseId: v })}
              options={options}
            />
          </div>

          {loading ? (
            <WidgetLoading />
          ) : !last ? (
            <WidgetEmpty icon={TrendingUp} text={t("exerciseProgress.noData")} />
          ) : (
            <>
              <Hero
                icon={<IconTile icon={Dumbbell} color={appColors.chartStrength} solid />}
                value={num(last.value)}
                unit={unit}
                sub={
                  points.length < 2
                    ? t("exerciseProgress.oneSession")
                    : fmt(t("exerciseProgress.span"), { weeks, n: points.length })
                }
                right={
                  points.length >= 2 ? (
                    <Pill
                      tone={delta > 0 ? "good" : delta < 0 ? "warn" : "neutral"}
                      label={`${delta > 0 ? "+" : ""}${num(delta)} ${unit}`}
                    />
                  ) : null
                }
              />
              <Sparkline points={points} color={appColors.chartStrength} />
            </>
          )}

          <div onClick={stop}>
            <div className="flex gap-1.5" role="tablist">
              {(["weight", "reps"] as Mode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="xs"
                  variant="prefs"
                  role="tab"
                  aria-selected={mode === m}
                  active={mode === m}
                  disabled={m === "weight" && !hasWeight}
                  onClick={() => save({ mode: m })}
                >
                  {t(`exerciseProgress.mode.${m}` as any)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
