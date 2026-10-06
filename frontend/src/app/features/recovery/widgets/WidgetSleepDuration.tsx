"use client";

import { BedDouble } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  DayBars,
  Hero,
  IconTile,
  Pill,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  fmtSleep,
  recoveryInfo,
  useRecoverySeries,
  weekdayNarrow,
} from "@/app/features/recovery/utils/recoveryWidget";

/*
 * Pásma podľa odporúčaní pre dospelých (National Sleep Foundation):
 * pod 6 h nedostatok, 6–7 h málo, 7–9 h optimum, nad 9 h dlho
 * (po ťažkom týždni alebo pri chorobe normálne, preto len info).
 */
function sleepTone(min: number): { tone: Tone; key: "short" | "low" | "optimal" | "long" } {
  if (min < 360) return { tone: "danger", key: "short" };
  if (min < 420) return { tone: "warn", key: "low" };
  if (min <= 540) return { tone: "good", key: "optimal" };
  return { tone: "info", key: "long" };
}

export default function WidgetSleepDuration({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const s = useRecoverySeries(rows, (r) => r.sleep_duration_min);
  const last7 = s.days.slice(-7);
  const hasAny = last7.some((d) => d.value != null);
  const st = s.today != null ? sleepTone(s.today) : null;

  return (
    <WidgetCard
      title={t("sleepDuration.widget.title")}
      tooltip={recoveryInfo(t, "sleepDuration")}
      accent={st && (st.tone === "warn" || st.tone === "danger") ? toneColor(st.tone) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !hasAny ? (
        <WidgetEmpty icon={BedDouble} text={t("sleepDuration.widget.noData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={BedDouble} color={st ? toneColor(st.tone) : appColors.textSecondary} />}
            value={fmtSleep(s.today)}
            sub={
              s.baseline
                ? `${t("recoveryWidgets.avg14")} ${fmtSleep(s.baseline)}`
                : s.today == null
                  ? t("sleepDuration.widget.noData")
                  : undefined
            }
            right={st ? <Pill tone={st.tone} label={t(`recoveryWidgets.sleep.${st.key}` as any)} /> : null}
          />
          {/* zelený podklad = 7–9 h, farba stĺpca = pásmo tej noci */}
          <DayBars
            values={last7.map((d) => d.value ?? 0)}
            colors={last7.map((d) => (d.value != null ? toneColor(sleepTone(d.value).tone) : null))}
            labels={last7.map((d) => weekdayNarrow(d.date, locale))}
            color={appColors.textMuted}
            max={600}
            band={[420, 540]}
          />
        </div>
      )}
    </WidgetCard>
  );
}
