// src/features/widgets/WidgetHRV.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

const TOOLTIP_HRV = [
  "HRV (RMSSD) = variabilita srdcovej frekvencie. Zjednodušene: ako „voľne“ vie autonómny nervový systém pracovať.",
  "",
  "Ako to čítať:",
  "• vyššie HRV často znamená lepšiu regeneráciu / nižší stres (parasympatikus dominuje)",
  "• nižšie HRV často znamená stres / únavu / chorobu / zlý spánok (sympatikus dominuje)",
  "",
  "Pozor na typické pasce:",
  "• HRV je veľmi citlivé na spánok, alkohol, hydratáciu, psychiku a teplotu",
  "• jedna noc nič neznamená – dôležitý je trend a kontext (ako sa cítiš + RHR + spánok)",
  "• keď si po extrémnom tréningu „rozbitý“, HRV môže spadnúť na 1–2 dni (bežné)",
  "",
  "Ako to hodnotíme v appke:",
  "• porovnávame poslednú hodnotu s baseline z posledných 14 dní (rolling baseline)",
  "• režim je higher-better (vyššie je lepšie)",
  "• malé výkyvy neriešime – varovanie dávame až pri výraznejšej odchýlke",
  "",
  "Prakticky:",
  "• HRV dole + RHR hore + spánok slabý → najčastejšie signál „uber, zregeneruj“",
  "• HRV hore + RHR normál → často dobrý deň na kvalitu (ak aj subjektívne cítiš energiu)",
  "",
  "Tip pre meranie:",
  "• najlepší signál je konzistentné meranie v rovnakých podmienkach (ráno po zobudení, bez rushu)",
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

export default function WidgetHRV({
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
      rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)),
    [rows],
  );

  const yesterday = useMemo<number | null>(() => {
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
    yesterday,
    baselinePoint,
    "higher-better",
    0.05,
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(yesterday)
      ? String(Math.round(yesterday as number))
      : "—";

  const note = showNA ? freshness.message : cmp.note;

  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });

  return (
    <WidgetCard
      title="HRV (RMSSD)"
      tooltip={TOOLTIP_HRV}
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
            <span className={WIDGET_VALUE_UNIT}>ms</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}