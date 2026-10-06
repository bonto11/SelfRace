"use client";

import { Moon } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { HHMMToMinutes } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Hero,
  IconTile,
  Pill,
  WidgetEmpty,
  WidgetLoading,
  tint,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import {
  fmtClock,
  recoveryInfo,
  useRecoverySeries,
  weekdayNarrow,
} from "@/app/features/recovery/utils/recoveryWidget";

const TARGET = 22 * 60 + 30; // 22:30
const TOL = 30;
// os grafu od 21:00, koniec aspoň 01:30 – pri neskoršom zaspatí sa predĺži
// (časy po polnoci sa posúvajú za 24:00)
const AXIS_FROM = 21 * 60;
const AXIS_TO_MIN = 25 * 60 + 30;

/** zaspatie po polnoci patrí ešte k večeru – 0:30 = 24:30 */
function evening(min: number | null): number | null {
  if (min == null) return null;
  return min < 18 * 60 ? min + 1440 : min;
}

function startTone(min: number): { tone: Tone; key: "early" | "onTime" | "late" } {
  if (min > TARGET + TOL) return { tone: min > TARGET + 90 ? "danger" : "warn", key: "late" };
  if (min < TARGET - TOL) return { tone: "info", key: "early" };
  return { tone: "good", key: "onTime" };
}

/**
 * Záznam regenerácie má dátum rána (kedy si vstal). Zaspatie patrí k večeru
 * predtým – 01:56 v sobotnom zázname je piatková noc, tak ju aj označ.
 */
function eveningOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 7 nocí ako bodky na časovej osi, zelený pás = cieľ ±30 min */
function NightDots({ nights, locale }: { nights: { date: string; value: number | null }[]; locale: string }) {
  const latest = Math.max(0, ...nights.map((n) => n.value ?? 0));
  // najneskoršie zaspatie + rezerva, zaokrúhlené na pol hodiny
  const axisTo = Math.max(AXIS_TO_MIN, Math.ceil((latest + 15) / 30) * 30);
  const pos = (m: number) => Math.max(0, Math.min(1, (m - AXIS_FROM) / (axisTo - AXIS_FROM))) * 100;
  return (
    <div className="space-y-1">
      {nights.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-3 text-[9px] uppercase text-center" style={{ color: appColors.textMuted }}>
            {weekdayNarrow(eveningOf(n.date), locale)}
          </span>
          <div className="relative flex-1 h-2">
            <div className="absolute inset-y-[3px] inset-x-0 rounded-full" style={{ background: appColors.surfaceCardBorder }} />
            <div
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${pos(TARGET - TOL)}%`,
                width: `${pos(TARGET + TOL) - pos(TARGET - TOL)}%`,
                background: tint(appColors.statusSuccess, 0.25),
              }}
            />
            {n.value != null ? (
              <span
                className="absolute top-0 w-2 h-2 -ml-1 rounded-full"
                style={{ left: `${pos(n.value)}%`, background: toneColor(startTone(n.value).tone) }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WidgetSleepStart({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const s = useRecoverySeries(rows, (r) => evening(r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time) : null));
  const last7 = s.days.slice(-7);
  const hasAny = last7.some((d) => d.value != null);
  const st = s.today != null ? startTone(s.today) : null;

  return (
    <WidgetCard
      title={t("sleepStart.widget.title")}
      tooltip={recoveryInfo(t, "sleepStart")}
      accent={st && (st.tone === "warn" || st.tone === "danger") ? toneColor(st.tone) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !hasAny ? (
        <WidgetEmpty icon={Moon} text={t("sleepStart.widget.noData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Moon} color={st ? toneColor(st.tone) : appColors.textSecondary} />}
            value={fmtClock(s.today)}
            sub={`${t("recoveryWidgets.target")} ${fmtClock(TARGET)} ± ${TOL} min`}
            right={st ? <Pill tone={st.tone} label={t(`recoveryWidgets.start.${st.key}` as any)} /> : null}
          />
          <NightDots nights={last7} locale={locale} />
        </div>
      )}
    </WidgetCard>
  );
}
