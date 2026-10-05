"use client";

import { useMemo } from "react";
import RecoveryTrend, { type TrendSpec } from "@/app/features/recovery/components/RecoveryTrend";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : NaN);

export default function TrendHRV() {
  const t = useT();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  const spec = useMemo<TrendSpec>(() => {
    const ms = t("common.units.ms");
    return {
      title: t("recovery.trends.hrv.title"),
      subtitle: t("recovery.trends.hrv.subtitle"),
      mainLabel: t("recovery.trends.hrv.hrvLabel"),
      altLabel: t("recovery.trends.hrv.hrvMaxLabel"),
      value: (r) => num(r.HRV_avg_ms),
      altValue: (r) => num(r.HRV_max_ms),
      band: { kind: "rolling", pct: 0.05 },
      bandLabel: t("recovery.trends.common.normalRange"),
      fmt: (v) => `${Math.round(v)} ${ms}`,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))} ${ms}`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 10,
    };
  }, [t]);

  return <RecoveryTrend spec={spec} showAlt={showAdvanced} />;
}
