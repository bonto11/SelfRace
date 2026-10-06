"use client";

import { Activity } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useT } from "@/app/shared/i18n/useT";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  Sparkline,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { recoveryInfo, useRecoverySeries } from "@/app/features/recovery/utils/recoveryWidget";

/*
 * HRV: vyššie = lepšie. Hranice voči vlastnému 14-dňovému priemeru:
 * ±5 % je bežný denný šum, pod −12 % je výrazný pokles (stres, choroba).
 */
function hrvTone(today: number, base: number): { tone: Tone; key: "above" | "normal" | "below" } {
  const pct = ((today - base) / base) * 100;
  if (pct >= 5) return { tone: "good", key: "above" };
  if (pct > -5) return { tone: "info", key: "normal" };
  return { tone: pct <= -12 ? "danger" : "warn", key: "below" };
}

export default function WidgetHRV({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const s = useRecoverySeries(rows, (r) => r.HRV_avg_ms);
  const spark = s.days.map((d) => d.value).filter((v): v is number => v != null);
  const st = s.today != null && s.baseline ? hrvTone(s.today, s.baseline) : null;
  const color = st ? toneColor(st.tone) : appColors.chartRecoveryMain;

  return (
    <WidgetCard
      title={t("HRV.widget.title")}
      tooltip={recoveryInfo(t, "hrv")}
      accent={st && (st.tone === "warn" || st.tone === "danger") ? color : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !spark.length ? (
        <WidgetEmpty icon={Activity} text={t("HRV.widget.noData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Activity} color={color} />}
            value={s.today != null ? Math.round(s.today) : "—"}
            unit={t("common.units.ms")}
            sub={s.baseline ? `${t("recoveryWidgets.avg14")} ${Math.round(s.baseline)} ${t("common.units.ms")}` : undefined}
            right={st ? <Pill tone={st.tone} label={t(`recoveryWidgets.state.${st.key}` as any)} /> : null}
          />
          <Sparkline values={spark} baseline={s.baseline} color={color} />
          {s.today == null ? <Caption>{t("HRV.widget.noData")}</Caption> : null}
        </div>
      )}
    </WidgetCard>
  );
}
