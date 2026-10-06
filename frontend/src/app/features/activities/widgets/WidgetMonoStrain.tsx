"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP, WIDGET_EMPTY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { Pill, ZoneMeter, type Tone } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

const RANK: Record<Tone, number> = { neutral: 0, info: 0, good: 1, warn: 2, danger: 3 };

// hranice pásiem – rovnaké ako doteraz v texte úrovní
const MONO_ZONES: { to: number; tone: Tone }[] = [
  { to: 1.5, tone: "good" },
  { to: 2.0, tone: "warn" },
  { to: 2.5, tone: "danger" },
];
const STRAIN_ZONES: { to: number; tone: Tone }[] = [
  { to: 1200, tone: "good" },
  { to: 1800, tone: "warn" },
  { to: 2400, tone: "danger" },
];

export default function WidgetMonoStrain({
  title,
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();
  const t = useT();
  const r7 = rolling7?.("time");
  const mono = (r7?.last?.mono ?? null) as number | null;
  const strain = (r7?.last?.strain ?? null) as number | null;

  // hranice tónov = hranice pásiem na stupnici
  const toneOf = (v: number | null, zones: { to: number; tone: Tone }[]): Tone => {
    if (v == null || !Number.isFinite(v)) return "neutral";
    return zones.find((z) => v <= z.to)?.tone ?? "danger";
  };
  const mT = toneOf(mono, MONO_ZONES);
  const sT = toneOf(strain, STRAIN_ZONES);
  const worst = RANK[mT] >= RANK[sT] ? mT : sT;

  const row = (label: string, value: string, v: number | null, max: number, zones: typeof MONO_ZONES) => (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs" style={{ color: appColors.textSecondary }}>{label}</span>
        <span className="text-xl font-bold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
          {value}
        </span>
      </div>
      <ZoneMeter value={v} max={max} zones={zones} />
    </div>
  );

  return (
    <WidgetCard
      title={title ?? t("monoStrain.widget.title")}
      tooltip={activityInfo(t, "mono")}
      accent={worst === "danger" ? appColors.statusError : worst === "warn" ? appColors.statusWarning : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : r7?.last ? (
        <div className="flex flex-col gap-3 text-left">
          {worst !== "neutral" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: appColors.textMuted }}>
                {t("activityWidgets.last7days")}
              </span>
              <Pill
                tone={worst}
                label={
                  worst === "danger"
                    ? t("activityWidgets.tone.danger")
                    : worst === "warn"
                      ? t("activityWidgets.tone.warn")
                      : t("activityWidgets.tone.good")
                }
              />
            </div>
          ) : null}
          {row(t("monoStrain.monotony"), mono == null ? "—" : mono.toFixed(2), mono, 2.5, MONO_ZONES)}
          {row(t("monoStrain.strain"), strain == null ? "—" : String(Math.round(strain)), strain, 2400, STRAIN_ZONES)}
        </div>
      ) : (
        <div className={WIDGET_EMPTY}>{t("monoStrain.widget.empty")}</div>
      )}
    </WidgetCard>
  );
}
