// src/app/shared/components/widgets/WidgetMonoStrain.tsx
"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP, WIDGET_EMPTY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { StatusChip, ZoneMeter, type Tone } from "@/app/shared/components/widgets/parts/WidgetParts";

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

  const monoLevel = (v: number | null): { tone: Tone; label: string } => {
    if (v == null || !Number.isFinite(v)) return { tone: "neutral", label: "—" };
    if (v < 0.8) return { tone: "good", label: t("monoStrain.levels.mono.low") };
    if (v <= 1.5) return { tone: "good", label: t("monoStrain.levels.mono.ok") };
    if (v <= 2.0) return { tone: "warn", label: t("monoStrain.levels.mono.warn") };
    return { tone: "danger", label: t("monoStrain.levels.mono.danger") };
  };
  const strainLevel = (v: number | null): { tone: Tone; label: string } => {
    if (v == null || !Number.isFinite(v)) return { tone: "neutral", label: "—" };
    if (v < 600) return { tone: "good", label: t("monoStrain.levels.strain.low") };
    if (v < 1200) return { tone: "good", label: t("monoStrain.levels.strain.ok") };
    if (v < 1800) return { tone: "warn", label: t("monoStrain.levels.strain.warn") };
    return { tone: "danger", label: t("monoStrain.levels.strain.danger") };
  };
  const mL = monoLevel(mono);
  const sL = strainLevel(strain);
  const worst = RANK[mL.tone] >= RANK[sL.tone] ? mL.tone : sL.tone;

  const row = (label: string, value: string, level: { tone: Tone; label: string }, v: number | null, max: number, zones: typeof MONO_ZONES) => (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs" style={{ color: appColors.textSecondary }}>{label}</span>
        <span className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
          {value}
        </span>
      </div>
      <ZoneMeter value={v} max={max} zones={zones} />
      <div className="text-[11px]" style={{ color: appColors.textMuted }}>{level.label}</div>
    </div>
  );

  return (
    <WidgetCard
      title={title ?? t("monoStrain.widget.title")}
      tooltip={t("monoStrain.widget.tooltip")}
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
          {row(t("monoStrain.monotony"), mono == null ? "—" : mono.toFixed(2), mL, mono, 2.5, MONO_ZONES)}
          {row(t("monoStrain.strain"), strain == null ? "—" : String(Math.round(strain)), sL, strain, 2400, STRAIN_ZONES)}
          <div className="text-[11px]" style={{ color: appColors.textMuted }}>
            {t("activityWidgets.monoHint")}
          </div>
          {worst === "warn" || worst === "danger" ? (
            <StatusChip tone={worst} label={t("activityWidgets.monoAdvice")} />
          ) : null}
        </div>
      ) : (
        <div className={WIDGET_EMPTY}>{t("monoStrain.widget.empty")}</div>
      )}
    </WidgetCard>
  );
}
