"use client";

import { useMemo } from "react";
import RecoveryTrend, { type TrendSpec } from "@/app/features/recovery/components/RecoveryTrend";
import { useT } from "@/app/shared/i18n/useT";

// nezmyselné hodnoty (preklep, 0) by roztiahli os
const sleepMin = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 18 * 60 ? v : NaN;

export default function TrendSleepDuration() {
  const t = useT();

  const spec = useMemo<TrendSpec>(() => {
    const h = t("common.units.hour");
    const min = t("common.units.min");
    const hm = (v: number) => {
      const m = Math.round(Math.abs(v));
      return `${Math.floor(m / 60)} ${h} ${String(m % 60).padStart(2, "0")} ${min}`;
    };
    return {
      title: t("recovery.trends.sleepDuration.title"),
      subtitle: t("recovery.trends.sleepDuration.subtitle"),
      mainLabel: t("recovery.trends.sleepDuration.label"),
      value: (r) => sleepMin(r.sleep_duration_min),
      band: { kind: "fixed", lo: 7 * 60, hi: 9 * 60 },
      bandLabel: t("recovery.trends.common.recommendedRange"),
      bandTexts: {
        below: t("recovery.trends.sleepDuration.below"),
        inside: t("recovery.trends.sleepDuration.inside"),
        above: t("recovery.trends.sleepDuration.above"),
      },
      fmt: hm,
      fmtShort: (v) => {
        const m = Math.round(v);
        return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} ${h}`;
      },
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${hm(d)}`,
      axisFmt: (v) => `${Math.round(v / 60)} ${h}`,
      yStep: 60,
    };
  }, [t]);

  return <RecoveryTrend spec={spec} />;
}
