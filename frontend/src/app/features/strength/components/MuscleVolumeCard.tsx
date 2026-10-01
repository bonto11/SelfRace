// src/app/features/strength/components/MuscleVolumeCard.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import {
  apiGetMuscleVolume,
  type MuscleVolumeOverview,
  type MuscleVolumeRow,
  type MuscleVolumeStatus,
} from "@/app/features/strength/api/strength_sessions";
import {
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";

type Bands = MuscleVolumeOverview["bands"];

function statusColor(status: MuscleVolumeStatus): string {
  if (status === "on_track") return appColors.statusSuccess;
  if (status === "over" || status === "under") return appColors.statusWarning;
  return appColors.textMuted;
}

/** 12 -> "12", 1.5 -> "1.5" */
function fmt(v: number): string {
  return String(Number(v.toFixed(1)));
}

/**
 * Pásma na pozadí pruhu - udržiavanie a rozvoj. Všetky pruhy zdieľajú
 * jednu mierku (0..scaleMax), takže sú navzájom porovnateľné a pásma
 * sedia na rovnakom mieste.
 */
function BandBackground({ bands, scaleMax }: { bands: Bands; scaleMax: number }) {
  const pct = (v: number) => `${Math.min((v / scaleMax) * 100, 100)}%`;
  const width = (from: number, to: number) =>
    `${Math.max(0, Math.min((to - from) / scaleMax, 1)) * 100}%`;

  return (
    <>
      <div
        className="absolute inset-y-0"
        style={{
          left: pct(bands.maintenance_min),
          width: width(bands.maintenance_min, bands.maintenance_max),
          background: "rgba(255,255,255,0.07)",
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          left: pct(bands.development_min),
          width: width(bands.development_min, bands.development_max),
          background: "rgba(255,255,255,0.13)",
        }}
      />
    </>
  );
}

function ScaleLegend({ bands, scaleMax }: { bands: Bands; scaleMax: number }) {
  const t = useT();
  const left = (v: number) => `${(v / scaleMax) * 100}%`;
  const width = (from: number, to: number) => `${((to - from) / scaleMax) * 100}%`;

  const Segment = ({
    from,
    to,
    label,
    opacity,
  }: {
    from: number;
    to: number;
    label: string;
    opacity: number;
  }) => (
    <div
      className="absolute h-full rounded flex items-center justify-center overflow-hidden"
      style={{
        left: left(from),
        width: width(from, to),
        background: `rgba(255,255,255,${opacity})`,
      }}
    >
      <span className="text-[9px] uppercase tracking-wide opacity-70 whitespace-nowrap px-1">
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-1 mb-1">
      <div className="relative h-4">
        <Segment
          from={bands.maintenance_min}
          to={bands.maintenance_max}
          label={t("muscleVolume.bandMaintain" as any)}
          opacity={0.07}
        />
        <Segment
          from={bands.development_min}
          to={bands.development_max}
          label={t("muscleVolume.bandDevelop" as any)}
          opacity={0.13}
        />
      </div>
      <div className="relative h-3 text-[9px] opacity-40 tabular-nums">
        {[0, bands.maintenance_min, bands.development_min, bands.development_max].map((v) => (
          <span
            key={v}
            className="absolute -translate-x-1/2"
            style={{ left: left(v) }}
          >
            {v}
          </span>
        ))}
        <span className="absolute right-0">
          {t("muscleVolume.scaleUnit" as any)}
        </span>
      </div>
    </div>
  );
}

function MuscleRow({
  row,
  label,
  bands,
  scaleMax,
}: {
  row: MuscleVolumeRow;
  label: string;
  bands: Bands;
  scaleMax: number;
}) {
  const color = statusColor(row.status);
  const w = (v: number) => `${Math.min((v / scaleMax) * 100, 100)}%`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {fmt(row.sets_this_week)}
          {row.sets_planned > 0 ? ` (+${fmt(row.sets_planned)})` : ""} / {row.target}
        </span>
      </div>

      <div
        className="relative h-2 rounded-full overflow-hidden"
        style={{ background: appColors.surfaceSolid }}
      >
        <BandBackground bands={bands} scaleMax={scaleMax} />

        {/* naplánované (svetlejšie) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: w(row.sets_projected), background: color, opacity: 0.4 }}
        />
        {/* zapísané */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: w(row.sets_this_week), background: color }}
        />
        {/* cieľ */}
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ left: w(row.target), background: "rgba(255,255,255,0.75)" }}
        />
      </div>
    </div>
  );
}

/**
 * Objem na partie za tento týždeň: zapísané série + to, čo je ešte
 * naplánované. Pásma (udržiavanie / rozvoj) a cieľ sú v jednej mierke,
 * takže je hneď vidieť, na čom partia je.
 */
export default function MuscleVolumeCard({ weeksBack = 4 }: { weeksBack?: number }) {
  const t = useT();
  const { userId } = useUserId();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<MuscleVolumeOverview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    apiGetMuscleVolume(Number(userId), weeksBack).then((res) => {
      if (!alive) return;
      setData(res);
      setFailed(!res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, weeksBack]);

  const rows = (data?.muscles ?? []).filter(
    (m) => m.sets_this_week > 0 || m.sets_planned > 0 || m.sets_avg_per_week > 0,
  );
  const scaleMax = data?.scale_max || 22;

  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
        <div className="min-w-0">
          <div className={PANEL_SECTION_TITLE}>
            <span className="inline-flex items-center gap-2">
              {t("muscleVolume.title" as any)}
              <TooltipIcon text={t("muscleVolume.tooltip" as any)} />
            </span>
          </div>
          <div className={PANEL_SECTION_SUBTITLE}>
            {data
              ? (t(`muscleVolume.goals.${data.goal}` as any) as string)
              : t("muscleVolume.subtitle" as any)}
          </div>
        </div>
      </header>

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="button" />
          </div>
        ) : failed ? (
          <div className={PANEL_PREVIEW}>{t("muscleVolume.error" as any)}</div>
        ) : rows.length === 0 || !data ? (
          <div className={PANEL_PREVIEW}>{t("muscleVolume.empty" as any)}</div>
        ) : (
          <>
            <ScaleLegend bands={data.bands} scaleMax={scaleMax} />

            <div className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <MuscleRow
                  key={row.muscle}
                  row={row}
                  label={t(`muscleVolume.muscles.${row.muscle}` as any)}
                  bands={data.bands}
                  scaleMax={scaleMax}
                />
              ))}
            </div>

            <div className="text-[11px] opacity-60 leading-snug mt-1">
              {t("muscleVolume.legendTarget" as any)}
              {data.total_sets_planned > 0 ? ` ${t("muscleVolume.legend" as any)}` : ""}
            </div>

            {data.run_volume_tier === "high" && (
              <div className="text-[11px] opacity-60 leading-snug">
                {t("muscleVolume.legCapHint" as any)}
              </div>
            )}
          </>
        )}
      </div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}