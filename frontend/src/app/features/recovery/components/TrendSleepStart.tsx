"use client";

import { useMemo } from "react";
import RecoveryTrend, { type RecoveryTrendSpec } from "@/app/features/recovery/components/RecoveryTrend";
import { useT } from "@/app/shared/i18n/useT";

const DAY = 24 * 60;

/**
 * Čas zaspania v minútach na osi. Časy po polnoci (do 12:00) posúvame
 * o deň dopredu, aby 00:30 bolo „neskôr“ ako 23:30 a nie na spodku grafu.
 */
function startMinutes(raw: unknown): number {
  if (typeof raw !== "string") return NaN;
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return NaN;
  const v = Number(m[1]) * 60 + Number(m[2]);
  if (!Number.isFinite(v) || v >= DAY) return NaN;
  return v < 12 * 60 ? v + DAY : v;
}

const clock = (v: number) => {
  const m = ((Math.round(v) % DAY) + DAY) % DAY;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

export default function TrendSleepStart() {
  const t = useT();

  const spec = useMemo<RecoveryTrendSpec>(
    () => ({
      title: t("recovery.trends.sleepStart.title"),
      subtitle: t("recovery.trends.sleepStart.subtitle"),
      mainLabel: t("recovery.trends.sleepStart.label"),
      value: (r) => startMinutes(r.sleep_start_time),
      band: { kind: "fixed", lo: 22 * 60, hi: 23 * 60 },
      bandLabel: t("recovery.trends.common.recommendedRange"),
      bandTexts: {
        below: t("recovery.trends.sleepStart.below"),
        inside: t("recovery.trends.sleepStart.inside"),
        above: t("recovery.trends.sleepStart.above"),
      },
      fmt: clock,
      fmtStat: clock,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}`,
      axisFmt: clock,
      yStep: 60,
    }),
    [t],
  );

  return <RecoveryTrend spec={spec} />;
}
