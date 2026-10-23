"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { Hero, IconTile, Pill, Sparkline, type Tone } from "@/app/shared/ui/widget/WidgetParts";
import { trendPoints } from "@/app/features/performance/utils/performanceWidget";
import type { NutritionGoal } from "@/app/features/nutrition/types/nutrition";

const DAY_MS = 86_400_000;
// zmena sa ráta za posledné 4 týždne – kratšie okno je len kolísanie vody
const TREND_DAYS = 28;

/**
 * Váha pri výžive: posledné meranie, krivka a tempo zmeny za 4 týždne
 * oproti cieľu (chudnutie / naberanie). Merania sú z Výkonu (users_metrics).
 */
export default function NutritionWeightCard({ goal, locale }: { goal: NutritionGoal; locale: string }) {
  const t = useT();
  const router = useRouter();
  const { data } = usePerformanceData();
  const points = useMemo(() => trendPoints(data.bodyWeightTrend), [data.bodyWeightTrend]);

  const last = points[points.length - 1];
  const rate = useMemo(() => {
    if (!last) return null;
    const lastT = new Date(last.date).getTime();
    const from = points.find((p) => lastT - new Date(p.date).getTime() <= TREND_DAYS * DAY_MS);
    if (!from || from === last) return null;
    const weeks = (lastT - new Date(from.date).getTime()) / (7 * DAY_MS);
    return weeks >= 1 ? (last.value - from.value) / weeks : null;
  }, [points, last]);

  if (!last) return null;

  // tempo podľa cieľa: chudnutie = dole, naberanie = hore, udržiavanie = ±0,25 kg
  let tone: Tone = "neutral";
  if (rate != null) {
    if (goal === "lose") tone = rate < -0.05 ? "good" : "warn";
    else if (goal === "gain") tone = rate > 0.05 ? "good" : "warn";
    else tone = Math.abs(rate) <= 0.25 ? "good" : "warn";
  }
  const rateText =
    rate != null
      ? `${rate > 0 ? "+" : ""}${rate.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
      : null;

  return (
    <button
      type="button"
      onClick={() => router.push("/performance/bodyweight")}
      className={[CARD, "p-4 sm:p-5 flex flex-col gap-3 text-left w-full"].join(" ")}
      style={SURFACE_CARD_STYLE}
    >
      <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
        {t("nutrition.weight.title")}
      </h3>
      <Hero
        icon={<IconTile icon={Scale} color={appColors.textSecondary} />}
        value={last.value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        unit="kg"
        sub={new Date(`${last.date}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "numeric" })}
        right={rateText ? <Pill tone={tone} label={fmt(t("nutrition.weight.rate"), { n: rateText })} /> : null}
      />
      <Sparkline points={points.slice(-30)} color={appColors.textSecondary} />
    </button>
  );
}
