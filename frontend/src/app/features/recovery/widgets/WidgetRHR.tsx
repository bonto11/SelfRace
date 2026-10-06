"use client";

import { HeartPulse } from "lucide-react";
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
 * Pokojový tep: nižšie = lepšie. Porovnáva sa v úderoch, nie v % – +3 údery
 * ráno sú už signál (únava, začínajúca choroba, alkohol), +6 je výrazné.
 */
function rhrTone(today: number, base: number): { tone: Tone; key: "above" | "normal" | "below" } {
  const diff = today - base;
  if (diff >= 3) return { tone: diff >= 6 ? "danger" : "warn", key: "above" };
  if (diff <= -2) return { tone: "good", key: "below" };
  return { tone: "info", key: "normal" };
}

export default function WidgetRHR({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const s = useRecoverySeries(rows, (r) => r.RHR_bpm);
  // os podľa dátumu – vynechaný deň sa premostí čiarou, ale nezhustí os
  const spark = s.days.filter((d) => d.value != null).map((d) => ({ date: d.date, value: d.value as number }));
  const st = s.today != null && s.baseline ? rhrTone(s.today, s.baseline) : null;
  const color = st ? toneColor(st.tone) : appColors.chartRecoveryAlt;

  return (
    <WidgetCard
      title={t("RHR.widget.title")}
      tooltip={recoveryInfo(t, "rhr")}
      accent={st && (st.tone === "warn" || st.tone === "danger") ? color : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !spark.length ? (
        <WidgetEmpty icon={HeartPulse} text={t("RHR.widget.noData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={HeartPulse} color={color} />}
            value={s.today != null ? Math.round(s.today) : "—"}
            unit={t("recoveryWidgets.bpm")}
            sub={s.baseline ? `${t("recoveryWidgets.avg14")} ${Math.round(s.baseline)} ${t("recoveryWidgets.bpm")}` : undefined}
            right={st ? <Pill tone={st.tone} label={t(`recoveryWidgets.state.${st.key}` as any)} /> : null}
          />
          <Sparkline points={spark} hold={false} baseline={s.baseline} color={color} />
          {s.today == null ? <Caption>{t("RHR.widget.noData")}</Caption> : null}
        </div>
      )}
    </WidgetCard>
  );
}
