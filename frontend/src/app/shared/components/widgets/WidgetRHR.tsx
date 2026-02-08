// src/features/widgets/WidgetRHR.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

const TOOLTIP_RHR = [
  "Resting HR (RHR) = pokojový tep. Je to jeden z najjednoduchších signálov, či je telo oddýchnuté alebo ide „na dlh“.",
  "",
  "Ako to čítať:",
  "• RHR je veľmi individuálny. Dôležitejší než absolútne číslo je trend vs. tvoj vlastný baseline.",
  "• Krátkodobý nárast (1–2 dni) môže byť normálny: horší spánok, stres, alkohol, teplo, dehydrát, začínajúca viróza.",
  "• Vyšší RHR viac dní po sebe často znamená kumulovanú únavu / nedoregenerovanie.",
  "",
  "Čo zvyčajne RHR zvyšuje:",
  "• vyšší tréningový load (hlavne intenzita), málo spánku, psychický stres",
  "• choroba, zápal, alergie, teplo, zlá hydratácia",
  "• alkohol a neskoré jedlo",
  "",
  "Čo zvyčajne RHR znižuje:",
  "• dobrý spánok, deload, ľahký týždeň, stabilný režim",
  "",
  "Ako to hodnotíme v appke:",
  "• porovnávame poslednú hodnotu s baseline z posledných 14 dní (rolling baseline)",
  "• režim je lower-better (nižšie je lepšie)",
  "• malé výkyvy neriešime – varovanie dávame až pri výraznejšej odchýlke",
  "",
  "Praktický tip:",
  "• ak je RHR zvýšené + HRV klesá + cítiš sa „ťažký“ → skôr recovery/easy deň alebo voľno",
  "• ak je RHR vyššie, ale cítiš sa dobre a ostatné metriky sú OK → nemusí to byť problém (pozri kontext)",
].join("\n");

function pickAccentFromCmp(
  cmpAccent: unknown,
  opts: { loading: boolean; showNA: boolean },
) {
  if (opts.loading || opts.showNA) return appColors.stateNeutral;

  const a = String(cmpAccent ?? "").toLowerCase();

  if (a.includes("red")) return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return "none";

  return "none";
}

export default function WidgetRHR({
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
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
    [rows],
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  const cmp = compareLatestToBaseline(
    latest,
    baselinePoint,
    "lower-better",
    0.05,
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest)
      ? String(Math.round(latest as number))
      : "—";

  const note = showNA ? freshness.message : cmp.note;

  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });

  return (
    <WidgetCard
      title="Resting HR"
      tooltip={TOOLTIP_RHR}
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
            <span className={WIDGET_VALUE_UNIT}>bpm</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}