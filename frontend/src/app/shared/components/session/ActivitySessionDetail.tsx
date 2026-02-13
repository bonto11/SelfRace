// src/app/shared/components/session/ActivitySessionDetail.tsx
"use client";

import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  SURFACE_INLINE,
  SURFACE_INLINE_STYLE,
  SESSION_DIVIDER,
  SESSION_DIVIDER_STYLE,
  SESSION_PILL,
  SESSION_PILL_STYLE,
  SESSION_PILL_ACTIVE_STYLE,
  SESSION_PILL_DANGER_STYLE,
  CHART_HR
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

import Button from "@/app/shared/ui/components/Button";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { ActivityStreamCharts } from "@/app/shared/components/trend/StreamCharts";
import { StreamsData } from "@/app/features/activities/types/activities";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { ActivitySplitsSection } from "./ActivitySplitsSection";

import type { ActivitySession } from "./SessionCard";
import { getStravaActivityUrl } from "@/app/features/strava/utils/links";
import { useUserId } from "@/app/shared/hooks/useUserId";

import ActivityCoachReviewSection from "./ActivityReviewSection";
import {
  PieTrend,
  type PieTrendItem,
} from "@/app/shared/components/trend/PieTrend";
import { type ActivityEnrichment } from "@/app/features/activities/api/activities_enrichment";

/** ================= helpers ================= */
function fmtTime(min: number) {
  if (min < 1) return "<1m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type InfoItem = {
  label: string;
  value: string | number | null;
};

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function safeText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isMeaningfulNumber(n: any, { allowZero = false } = {}): n is number {
  if (n == null) return false;
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return false;
  if (!allowZero && x === 0) return false;
  return true;
}

function valOrNullNumber(
  n: any,
  { allowZero = false, fmt }: { allowZero?: boolean; fmt?: (x: number) => string } = {},
): string | null {
  if (!isMeaningfulNumber(n, { allowZero })) return null;
  const x = typeof n === "number" ? n : Number(n);
  return fmt ? fmt(x) : String(x);
}

function nonEmptyText(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "—") return null;
  if (s === "0" || s === "0.0" || s === "0.00" || s === "0.000") return null;
  return s;
}

function hasMeaningfulValue(items?: InfoItem[]): boolean {
  if (!items || items.length === 0) return false;
  return items.some((it) => {
    const v = it.value;
    if (v === null || v === undefined) return false;
    if (typeof v === "number") return Number.isFinite(v) && v !== 0;
    return nonEmptyText(v) != null;
  });
}

function formatCadenceSummary(s: any | null, t: any): string | null {
  if (!s || s.average_cadence_rpm == null) return null;
  const sport = (s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? "").toString().toLowerCase();
  const rpm = s.average_cadence_rpm;
  if (sport.includes("run")) {
    const spm = Math.round(rpm * 2);
    return `${spm} ${t("sessions.detail.unitStepsPerMin")}`;
  }
  return `${rpm} rpm`;
}

function formatPaceFromSpeedMps(speed: number | null | undefined, t: any): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  const secStr = String(seconds).padStart(2, "0");
  return `${minutes}:${secStr} ${t("common.units.pace")}`;
}

function zoneColor(zoneNum: number) {
  const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
  if (zoneNum === 1) return z1;
  if (zoneNum === 2) return z2;
  if (zoneNum === 3) return z3;
  if (zoneNum === 4) return z4;
  return z5;
}

/** ============ lokálny accordion shell ============ */
type SectionProps = {
  title: string;
  defaultOpen?: boolean;
  items?: InfoItem[];
  children?: ReactNode;
};

const INLINE_WRAP_CLASS = [SURFACE_INLINE, "px-0 py-0 overflow-hidden"].join(" ");
const INLINE_WRAP_STYLE: CSSProperties = SURFACE_INLINE_STYLE;

const INFO_TILE_CLASS = "rounded-lg border px-2.5 py-1.5";
const INFO_TILE_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

export function ActivitySectionShell({ title, defaultOpen, items, children }: SectionProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hasItems = hasMeaningfulValue(items);
  const showShell = hasItems || !!children;
  if (!showShell) return null;

  return (
    <section className="mt-3">
      <div className={INLINE_WRAP_CLASS} style={INLINE_WRAP_STYLE}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold tracking-tight"
        >
          <span className="min-w-0">{title}</span>
          <span className={["text-base leading-none select-none transition-transform", open ? "rotate-180" : ""].join(" ")}>
            ▾
          </span>
        </button>

        {open && (
          <div className={[SESSION_DIVIDER, "px-3 py-2 text-sm"].join(" ")} style={SESSION_DIVIDER_STYLE}>
            {hasItems && items && items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {items.map((t) => (
                  <div key={t.label} className={INFO_TILE_CLASS} style={INFO_TILE_STYLE}>
                    <div className="text-[10px] opacity-70 leading-tight">{t.label}</div>
                    <div className="text-sm font-semibold tabular-nums leading-tight">{valOrDash(t.value)}</div>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/** ================= main component ================= */
type ActivitySessionDetailProps = {
  item: ActivitySession;
  kpiBlock: ReactNode;
  hasKpis: boolean;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
};

export function ActivitySessionDetail({ item, kpiBlock, hasKpis, compactChart, onOpenActivity }: ActivitySessionDetailProps) {
  const act = item;
  const t = useT();
  const { userId } = useUserId();
  const activityData: any = useActivityData() as any;
  const { getSummary, getExtras, getEnrichment } = activityData;

  const s: any | null = act.activityId != null ? (getSummary(act.activityId) as any) || null : null;

  const distTxt = s ? formatDistance(s.distance_m ?? null) : act.distanceStr ?? "—";
  const timeTxt = s && s.moving_time_s != null ? fmtSecondsHMS(s.moving_time_s) : act.timeStr ?? "—";
  const avgHrTxt = s ? s.average_heartrate_bpm ?? "—" : act.avgHr ?? "—";
  const maxHrTxt = s ? s.max_heartrate_bpm ?? "—" : act.maxHr ?? "—";
  const cadenceLabel = formatCadenceSummary(s, t);
  const paceLabel = formatPaceFromSpeedMps(s?.average_speed_mps, t);
  const stravaActivityId = (s && (s.activity_id ?? s.id)) ?? act.activityId ?? null;

  const stravaUrl =
    stravaActivityId !== null && (typeof stravaActivityId === "number" || typeof stravaActivityId === "string")
      ? getStravaActivityUrl(stravaActivityId)
      : null;

  const openStrava = () => {
    if (!stravaUrl) return;
    window.open(stravaUrl, "_blank", "noopener,noreferrer");
  };

  const [streams, setStreams] = useState<StreamsData>({
    time_s: [], hr: [], duration_s: 0, cadence_rpm: [], power_w: [], distance_m: [], altitude_m: [],
  });

  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [enrichment, setEnrichment] = useState<ActivityEnrichment | null>(null);
  const [busyFetch, setBusyFetch] = useState(false);

  const applyExtrasToState = (ex: any) => {
    const rawStreams: any = ex?.streams ?? null;
    if (rawStreams && Array.isArray(rawStreams.time_s)) {
      setStreams({
        time_s: rawStreams.time_s,
        hr: Array.isArray(rawStreams.hr) ? rawStreams.hr : [],
        duration_s: Number(rawStreams.duration_s) || 0,
        cadence_rpm: Array.isArray(rawStreams.cadence_rpm) ? rawStreams.cadence_rpm : [],
        power_w: Array.isArray(rawStreams.power_w) ? rawStreams.power_w : [],
        distance_m: Array.isArray(rawStreams.distance_m) ? rawStreams.distance_m : [],
        altitude_m: Array.isArray(rawStreams.altitude_m) ? rawStreams.altitude_m : [],
      });
    }
    setLaps(Array.isArray(ex?.laps) ? ex.laps : []);
    setSplits(Array.isArray(ex?.splits) ? ex.splits : []);
  };

  // 1. ZMENA: Načítanie dát pri zobrazení detailu aktivity
  useEffect(() => {
    if (!act.activityId) return;

    let alive = true;
    const fetchDetailedData = async () => {
      setBusyFetch(true);
      try {
        // Načítaj grafy, kolá a medzičasy (streams, laps, splits)
        const extras = await getExtras(act.activityId);
        if (alive && extras) {
          applyExtrasToState(extras);
        }

        // Načítaj zóny pre koláčový graf (enrichment)
        const enr = await getEnrichment(act.activityId);
        if (alive && enr) {
          setEnrichment(enr);
        }
      } catch (err) {
        console.error("Failed to load activity details", err);
      } finally {
        if (alive) setBusyFetch(false);
      }
    };

    fetchDetailedData();

    return () => {
      alive = false;
    };
  }, [act.activityId, getExtras, getEnrichment]);

  const overviewItems: InfoItem[] = [
    { label: t("common.metrics.time").toUpperCase(), value: timeTxt },
    { label: t("common.metrics.distance").toUpperCase(), value: distTxt },
    paceLabel ? { label: t("common.metrics.hr_avg").toUpperCase(), value: paceLabel } : null,
  ].filter(Boolean) as InfoItem[];

  const hrItems: InfoItem[] = [
    isMeaningfulNumber(avgHrTxt) ? { label: t("common.metrics.hr_avg").toUpperCase(), value: avgHrTxt } : null,
    isMeaningfulNumber(maxHrTxt) ? { label: t("common.metrics.hr_max").toUpperCase(), value: maxHrTxt } : null,
  ].filter(Boolean) as InfoItem[];

  const elevGain = valOrNullNumber(s?.elevation_gain_m, { fmt: (x) => `${x} m` });
  const cadence = cadenceLabel ? { label: t("sessions.splits.colCadence").toUpperCase(), value: cadenceLabel } : null;

  const elevItems: InfoItem[] = [
    elevGain ? { label: t("sessions.splits.colElev").toUpperCase(), value: elevGain } : null,
    cadence,
  ].filter(Boolean) as InfoItem[];

  const zoneItems: PieTrendItem[] = [
    { label: "Z1", value: enrichment?.z1_min || 0, color: zoneColor(1) },
    { label: "Z2", value: enrichment?.z2_min || 0, color: zoneColor(2) },
    { label: "Z3", value: enrichment?.z3_min || 0, color: zoneColor(3) },
    { label: "Z4", value: enrichment?.z4_min || 0, color: zoneColor(4) },
    { label: "Z5", value: enrichment?.z5_min || 0, color: zoneColor(5) },
  ];

  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-2">
        {act.onToggleFavorite && (
          <button type="button" onClick={act.onToggleFavorite} className={SESSION_PILL} style={act.isFavorite ? SESSION_PILL_ACTIVE_STYLE : SESSION_PILL_STYLE}>
            {act.isFavorite ? `★ ${t("sessions.detail.btnFavoriteUnset")}` : `☆ ${t("sessions.detail.btnFavoriteSet")}`}
          </button>
        )}
        {act.onEdit && (
          <button type="button" onClick={act.onEdit} className={SESSION_PILL} style={SESSION_PILL_STYLE}>{t("common.edit")}</button>
        )}
        {act.onDelete && (
          <button type="button" onClick={act.onDelete} className={SESSION_PILL} style={SESSION_PILL_DANGER_STYLE}>{t("common.delete")}</button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onOpenActivity && (
          <button type="button" onClick={() => onOpenActivity(act.activityId)} className={SESSION_PILL} style={SESSION_PILL_STYLE}>{t("calendar.openActivity")}</button>
        )}
        {stravaUrl && (
          <Button type="button" variant="viewOnStrava" size="sm" onClick={openStrava}>{t("sessions.detail.btnStrava")}</Button>
        )}
      </div>

      {hasMeaningfulValue(overviewItems) && <ActivitySectionShell title={t("sessions.detail.sectionOverview")} defaultOpen={true} items={overviewItems} />}
      
      {!!act.activityId && <ActivityCoachReviewSection item={act} activityId={Number(act.activityId)} />}

      {/* 2. ZMENA: Vykreslenie ActivityStreamCharts, ak máme načítané dáta v streams */}
      {streams.time_s && streams.time_s.length > 0 && (
        <div className="mt-4 px-1">
          <ActivityStreamCharts streams={streams} compact={compactChart} />
        </div>
      )}

      {hasMeaningfulValue(hrItems) && (
        <ActivitySectionShell title={t("sessions.detail.sectionHR")} items={hrItems}>
          {enrichment && (
            <div className="mb-6 border-b border-white/5 pb-6 mt-4">
              <div className="text-[10px] uppercase font-bold opacity-50 mb-4 text-center sm:text-left">
                {t("sessions.detail.zonesDistribution")}
              </div>
              <div className="flex justify-center sm:justify-start">
                <PieTrend items={zoneItems} valueFormatter={fmtTime} />
              </div>
            </div>
          )}
        </ActivitySectionShell>
      )}

      {hasMeaningfulValue(elevItems) && (
        <ActivitySectionShell title={t("sessions.detail.sectionElevation")} items={elevItems} />
      )}

      {Array.isArray(splits) && splits.length > 1 && (
        <ActivitySectionShell title={t("sessions.detail.sectionSplits")}><ActivitySplitsSection kind={splits} /></ActivitySectionShell>
      )}

      {act.notes && <div className="mt-3 text-sm opacity-90">{safeText(act.notes)}</div>}
    </div>
  );
}
