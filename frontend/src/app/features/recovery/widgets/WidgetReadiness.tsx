"use client";

import { Battery, BatteryFull, BatteryLow, BatteryMedium } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { useReadinessScore } from "@/app/shared/hooks/useReadinessScore";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Highlight,
  Hero,
  IconTile,
  Pill,
  ProgressRow,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { recoveryInfo } from "@/app/features/recovery/utils/recoveryWidget";

/** rovnaké hranice ako readinessLabelKey: 70+ tréning bez obmedzení, pod 55 len ľahko */
function scoreTone(score: number | null): Tone {
  if (score == null) return "neutral";
  if (score >= 70) return "good";
  if (score >= 55) return "warn";
  return "danger";
}

export default function WidgetReadiness({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const r = useReadinessScore(rows);
  const tone = scoreTone(r.score);
  const c = r.components;
  const Icon = r.score == null ? Battery : r.score >= 70 ? BatteryFull : r.score >= 55 ? BatteryMedium : BatteryLow;

  const parts = [
    { key: "hrv", label: "HRV", score: c.hrv.score },
    { key: "rhr", label: t("recoveryWidgets.rhrShort"), score: c.rhr.score },
    { key: "sleep", label: t("recoveryWidgets.sleepShort"), score: c.sleep.score },
  ];
  const bad = [
    c.factors.alcohol ? t("readiness.detail.factorAlcohol") : null,
    c.factors.caffeine ? t("readiness.detail.factorCaffeine") : null,
    c.factors.food ? t("readiness.detail.factorFood") : null,
  ].filter(Boolean) as string[];

  return (
    <WidgetCard
      title={t("readiness.widget.title")}
      tooltip={recoveryInfo(t, "readiness")}
      accent={tone === "danger" ? toneColor(tone) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : r.score == null ? (
        <WidgetEmpty icon={Battery} text={t("readiness.detail.notEnoughData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Icon} color={toneColor(tone)} />}
            value={r.score}
            unit="/ 100"
            right={<Pill tone={tone} label={t(r.label as any)} />}
          />
          <div className="grid grid-cols-3 gap-3">
            {parts.map((p) => (
              <ProgressRow
                key={p.key}
                label={p.label}
                done={p.score ?? 0}
                total={100}
                color={p.score == null ? appColors.surfaceCardBorder : toneColor(scoreTone(p.score))}
                value={p.score == null ? "—" : String(Math.round(p.score))}
              />
            ))}
          </div>
          {bad.length ? <Highlight tone="warn" text={`${t("recoveryWidgets.lowered")} ${bad.join(" · ")}`} /> : null}
        </div>
      )}
    </WidgetCard>
  );
}
