"use client";

import { useMemo } from "react";
import RecoveryTrend, { type TrendSpec } from "@/app/features/recovery/components/RecoveryTrend";
import { useT } from "@/app/shared/i18n/useT";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : NaN);

export default function TrendRHR() {
  const t = useT();

  const spec = useMemo<TrendSpec>(() => {
    const bpm = t("common.units.hr");
    return {
      title: t("recovery.trends.rhr.title"),
      subtitle: t("recovery.trends.rhr.subtitle"),
      mainLabel: t("recovery.trends.rhr.rhrLabel"),
      value: (r) => num(r.RHR_bpm),
      band: { kind: "rolling", pct: 0.05 },
      bandLabel: t("recovery.trends.common.normalRange"),
      fmt: (v) => `${Math.round(v)} ${bpm}`,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))} ${bpm}`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 5,
    };
  }, [t]);

  return <RecoveryTrend spec={spec} />;
}
