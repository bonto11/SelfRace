// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  checkRecoveryFreshness,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/app/shared/utils/recovery";
import { minutesToHHMM } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

const TOOLTIP_SLEEP_DURATION = [
  "Sleep duration = celkový čas spánku (v minútach), ktorý si zariadenie zapísalo za noc.",
  "",
  "Dôležité:",
  "• dĺžka spánku nie je všetko – kvalita a konzistentnosť často rozhodujú viac",
  "• ak máš málo spánku viac dní po sebe, výkon aj regenerácia idú dole aj keď tréning vyzerá „ok“",
  "",
  "Ako to tu hodnotíme:",
  "• porovnávame „poslednú noc“ s baseline z posledných 14 dní",
  "• baseline je robustný bod (aby ho nerozbila jedna extrémna noc)",
  "• režim je higher-better (viac spánku = lepšie)",
  "",
  "Tolerancia / prah:",
  "• až keď je odchýlka výraznejšia, ukazujeme varovanie (nepanikárime z malých výkyvov)",
  "",
  "Prakticky:",
  "• ak spánok padá pod baseline: skús najprv stabilný čas zaspania + menej kofeínu poobede",
  "• keď rastie tréningový objem/intenzita, často potrebuješ aj viac spánku (nie „rovnako ako vždy“)",
].join("\n");

export default function WidgetSleepDuration({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows, loading: loadingRaw } = useRecoveryData() as {
    rows: any[];
    loading?: boolean;
  };
  const loading = !!loadingRaw;

  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) =>
        typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : null,
      ),
    [rows],
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo(
    () => makeBaselinePoint(values, 14, true),
    [values],
  );

  const cmp = compareLatestToBaseline(
    latest,
    baselinePoint,
    "higher-better",
    0.05,
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest)
      ? minutesToHHMM(latest as number)
      : "—";

  const note = showNA ? freshness.message : cmp.note;

  const accent = (() => {
    if (loading || showNA) return appColors.stateNeutral;

    const a = String((cmp as any)?.accent ?? "").toLowerCase();

    if (a.includes("red")) return appColors.stateDanger;
    if (a.includes("amber") || a.includes("yellow"))
      return appColors.stateWarning;
    if (a.includes("emerald") || a.includes("green")) return "none";

    return "none";
  })();

  return (
    <WidgetCard
      title="Sleep duration"
      tooltip={TOOLTIP_SLEEP_DURATION}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}