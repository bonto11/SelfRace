// src/app/shared/components/session/ActivitySessionDetail.tsx
"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  SURFACE_INLINE,
  SURFACE_INLINE_STYLE,
  SESSION_DIVIDER,
  SESSION_DIVIDER_STYLE,
  SESSION_PILL,
  SESSION_PILL_STYLE,
  SESSION_PILL_ACTIVE_STYLE,
  SESSION_PILL_DANGER_STYLE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

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
} from "@/app/shared/components/trend/PieTrend"; // Uistite sa, že cesta sedí s tým, kam ste uložili PieTrend.tsx
import { type ActivityEnrichment } from "@/app/features/activities/api/activity_review";

/** ================= helpers ================= */
// Helper pre formátovanie času (môže byť v utils)
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
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
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
  {
    allowZero = false,
    fmt,
  }: { allowZero?: boolean; fmt?: (x: number) => string } = {},
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

function formatCadenceSummary(s: any | null): string | null {
  if (!s || s.average_cadence_rpm == null) return null;
  const sport = (s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? "")
    .toString()
    .toLowerCase();

  const rpm = s.average_cadence_rpm;

  if (sport.includes("run")) {
    const spm = Math.round(rpm * 2);
    return `${spm} steps/min`;
  }

  return `${rpm} rpm`;
}

function formatPaceFromSpeedMps(speed?: number | null): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  const secStr = String(seconds).padStart(2, "0");
  return `${minutes}:${secStr} min/km`;
}

/** ============ lokálny accordion shell ============ */

type SectionProps = {
  title: string;
  defaultOpen?: boolean;
  items?: InfoItem[];
  children?: ReactNode;
};

const INLINE_WRAP_CLASS = [SURFACE_INLINE, "px-0 py-0 overflow-hidden"].join(
  " ",
);
const INLINE_WRAP_STYLE: CSSProperties = SURFACE_INLINE_STYLE;

const INFO_TILE_CLASS = "rounded-lg border px-2.5 py-1.5";
const INFO_TILE_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

export function ActivitySectionShell({
  title,
  defaultOpen,
  items,
  children,
}: SectionProps) {
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
          <span
            className={[
              "text-base leading-none select-none transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          >
            ▾
          </span>
        </button>

        {open && (
          <div
            className={[SESSION_DIVIDER, "px-3 py-2 text-sm"].join(" ")}
            style={SESSION_DIVIDER_STYLE}
          >
            {hasItems && items && items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {items.map((t) => (
                  <div
                    key={t.label}
                    className={INFO_TILE_CLASS}
                    style={INFO_TILE_STYLE}
                  >
                    <div className="text-[10px] opacity-70 leading-tight">
                      {t.label}
                    </div>
                    <div className="text-sm font-semibold tabular-nums leading-tight">
                      {valOrDash(t.value)}
                    </div>
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

export function ActivitySessionDetail({
  item,
  kpiBlock,
  hasKpis,
  compactChart,
  onOpenActivity,
}: ActivitySessionDetailProps) {
  const act = item;

  const { userId } = useUserId();

  const activityData: any = useActivityData() as any;
  // ✅ 1. Získame getEnrichment z providera
  const { getSummary, getExtras, getEnrichment } = activityData;

  const s: any | null =
    act.activityId != null ? (getSummary(act.activityId) as any) || null : null;

  const distTxt = s
    ? formatDistance(s.distance_m ?? null)
    : (act.distanceStr ?? "—");
  const timeTxt =
    s && s.moving_time_s != null
      ? fmtSecondsHMS(s.moving_time_s)
      : (act.timeStr ?? "—");

  const avgHrTxt = s ? (s.average_heartrate_bpm ?? "—") : (act.avgHr ?? "—");
  const maxHrTxt = s ? (s.max_heartrate_bpm ?? "—") : (act.maxHr ?? "—");

  const cadenceLabel = formatCadenceSummary(s);
  const paceLabel = formatPaceFromSpeedMps(s?.average_speed_mps);

  const sportHint = (s?.sport_type_ovrd ??
    s?.sport_type_fe ??
    s?.sport_type ??
    act.sport ??
    "") as string;

  const stravaActivityId =
    (s && (s.activity_id ?? s.id)) ?? act.activityId ?? null;

  const stravaUrl =
    stravaActivityId !== null &&
    (typeof stravaActivityId === "number" ||
      typeof stravaActivityId === "string")
      ? getStravaActivityUrl(stravaActivityId)
      : null;

  const openStrava = () => {
    if (!stravaUrl) return;
    window.open(stravaUrl, "_blank", "noopener,noreferrer");
  };

  const [streams, setStreams] = useState<StreamsData>({
    time_s: [],
    hr: [],
    duration_s: 0,
    cadence_rpm: [],
    power_w: [],
    distance_m: [],
    altitude_m: [],
  });

  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  // ✅ 2. State pre enrichment dáta (zóny)
  const [enrichment, setEnrichment] = useState<ActivityEnrichment | null>(null);

  const [busyFetch, setBusyFetch] = useState(false);

  const applyExtrasToState = (ex: any) => {
    const rawStreams: any = ex?.streams ?? null;

    if (rawStreams && Array.isArray(rawStreams.time_s)) {
      setStreams({
        time_s: Array.isArray(rawStreams.time_s) ? rawStreams.time_s : [],
        hr: Array.isArray(rawStreams.hr) ? rawStreams.hr : [],
        duration_s:
          typeof rawStreams.duration_s === "number"
            ? rawStreams.duration_s
            : rawStreams.time_s?.length
              ? Number(rawStreams.time_s[rawStreams.time_s.length - 1]) || 0
              : 0,
        cadence_rpm: Array.isArray(rawStreams.cadence_rpm)
          ? rawStreams.cadence_rpm
          : [],
        power_w: Array.isArray(rawStreams.power_w) ? rawStreams.power_w : [],
        distance_m: Array.isArray(rawStreams.distance_m)
          ? rawStreams.distance_m
          : [],
        altitude_m: Array.isArray(rawStreams.altitude_m)
          ? rawStreams.altitude_m
          : [],
      });
    } else {
      setStreams({
        time_s: [],
        hr: [],
        duration_s: 0,
        cadence_rpm: [],
        power_w: [],
        distance_m: [],
        altitude_m: [],
      });
    }

    setLaps(Array.isArray(ex?.laps) ? ex.laps : []);
    setSplits(Array.isArray(ex?.splits) ? ex.splits : []);
  };

  // ✅ 3. Fetch Extras AND Enrichment
  useEffect(() => {
    let alive = true;
    if (!act.activityId) return;

    (async () => {
      try {
        // Fetch extras (streams)
        const ex = await getExtras(act.activityId, { fetch: false });
        if (!alive) return;
        applyExtrasToState(ex);

        // ✅ Fetch enrichment (zones)
        if (getEnrichment) {
          const enr = await getEnrichment(act.activityId, { fetch: false });
          if (alive && enr) setEnrichment(enr);
        }
      } catch (err) {
        console.error("[ActivitySessionDetail] fetch error", err);
        if (!alive) return;
        applyExtrasToState(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [act.activityId, getExtras, getEnrichment]);

  const onFetchMore = async () => {
    if (!act.activityId || busyFetch) return;
    setBusyFetch(true);
    try {
      // Force fetch oboch
      const ex = await getExtras(act.activityId, { fetch: true });
      applyExtrasToState(ex);

      if (getEnrichment) {
        const enr = await getEnrichment(act.activityId, { fetch: true });
        setEnrichment(enr);
      }
    } catch (e) {
      console.error("[ActivitySessionDetail] fetchMore error", e);
    } finally {
      setBusyFetch(false);
    }
  };

  /** ====== data pre jednotlivé sekcie ====== */

  const overviewItems: InfoItem[] = [
    { label: "TIME", value: timeTxt },
    { label: "DISTANCE", value: distTxt },
    paceLabel ? { label: "AVG PACE", value: paceLabel } : null,
  ].filter(Boolean) as InfoItem[];

  const hrItems: InfoItem[] = [
    isMeaningfulNumber(avgHrTxt) ? { label: "AVG HR", value: avgHrTxt } : null,
    isMeaningfulNumber(maxHrTxt) ? { label: "MAX HR", value: maxHrTxt } : null,
  ].filter(Boolean) as InfoItem[];

  const elevGain = valOrNullNumber(s?.elevation_gain_m, {
    fmt: (x) => `${x} m`,
  });
  const elevHigh = valOrNullNumber(s?.elev_high_m, { fmt: (x) => `${x} m` });
  const elevLow = valOrNullNumber(s?.elev_low_m, { fmt: (x) => `${x} m` });

  const elevItems: InfoItem[] = [
    elevGain ? { label: "ELEV GAIN", value: elevGain } : null,
    elevHigh ? { label: "ELEV HIGH", value: elevHigh } : null,
    elevLow ? { label: "ELEV LOW", value: elevLow } : null,
    cadenceLabel ? { label: "CADENCE", value: cadenceLabel } : null,
  ].filter(Boolean) as InfoItem[];

  const avgSpeed = valOrNullNumber(s?.average_speed_mps, {
    fmt: (x) => `${x.toFixed(3)} m/s`,
  });
  const maxSpeed = valOrNullNumber(s?.max_speed_mps, {
    fmt: (x) => `${x.toFixed(3)} m/s`,
  });
  const avgPower = valOrNullNumber(s?.average_watts, { fmt: (x) => `${x} W` });
  const maxPower = valOrNullNumber(s?.max_watts, { fmt: (x) => `${x} W` });

  const powerItems: InfoItem[] = [
    avgSpeed ? { label: "AVG SPEED", value: avgSpeed } : null,
    maxSpeed ? { label: "MAX SPEED", value: maxSpeed } : null,
    avgPower ? { label: "AVG POWER", value: avgPower } : null,
    maxPower ? { label: "MAX POWER", value: maxPower } : null,
  ].filter(Boolean) as InfoItem[];

  const avgTemp = valOrNullNumber(s?.average_temp_c, {
    allowZero: true,
    fmt: (x) => `${x} °C`,
  });
  const calories = valOrNullNumber(s?.calories_kcal, {
    allowZero: false,
    fmt: (x) => `${x} kcal`,
  });

  const envItems: InfoItem[] = [
    avgTemp ? { label: "AVG TEMP", value: avgTemp } : null,
    calories ? { label: "CALORIES", value: calories } : null,
  ].filter(Boolean) as InfoItem[];

  const showOverview = hasMeaningfulValue(overviewItems);
  const showHr = hasMeaningfulValue(hrItems);
  const showElev = hasMeaningfulValue(elevItems);
  const showPower = hasMeaningfulValue(powerItems);
  const showEnv = hasMeaningfulValue(envItems);

  const hasStreams =
    (streams.time_s?.length ?? 0) > 0 ||
    (streams.hr?.length ?? 0) > 0 ||
    (streams.cadence_rpm?.length ?? 0) > 0 ||
    (streams.power_w?.length ?? 0) > 0 ||
    (streams.distance_m?.length ?? 0) > 0 ||
    (streams.altitude_m?.length ?? 0) > 0;

  const hasCadStream = (streams.cadence_rpm?.length ?? 0) > 0;

  const hasSplits = Array.isArray(splits) && splits.length > 1;
  const hasLaps = Array.isArray(laps) && laps.length > 1;

  const canFetchMore =
    !hasStreams && !hasSplits && !hasLaps && !!act.activityId;

  const canShowActions =
    "onEdit" in act && (act.onEdit || act.onDelete || act.onToggleFavorite);

  // ✅ Helper pre zistenie či máme nejaké dáta o zónach
  const hasZones =
    enrichment &&
    (enrichment.z1_min || 0) +
      (enrichment.z2_min || 0) +
      (enrichment.z3_min || 0) +
      (enrichment.z4_min || 0) +
      (enrichment.z5_min || 0) >
      0;

  // ✅ Príprava dát pre PieTrend
  const zoneItems: PieTrendItem[] = [
    { label: "Z1", value: enrichment?.z1_min || 0, color: "#94a3b8" },
    { label: "Z2", value: enrichment?.z2_min || 0, color: "#4ade80" },
    { label: "Z3", value: enrichment?.z3_min || 0, color: "#facc15" },
    { label: "Z4", value: enrichment?.z4_min || 0, color: "#fb923c" },
    { label: "Z5", value: enrichment?.z5_min || 0, color: "#ef4444" },
  ];

  return (
    <div>
      {/* Akčné tlačidlá – HORE */}
      {canShowActions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {act.onToggleFavorite && (
            <button
              type="button"
              onClick={act.onToggleFavorite}
              className={SESSION_PILL}
              style={
                act.isFavorite ? SESSION_PILL_ACTIVE_STYLE : SESSION_PILL_STYLE
              }
            >
              {act.isFavorite ? "★ Favorite" : "☆ Set favorite"}
            </button>
          )}

          {act.onEdit && (
            <button
              type="button"
              onClick={act.onEdit}
              className={SESSION_PILL}
              style={SESSION_PILL_STYLE}
            >
              Edit
            </button>
          )}

          {act.onDelete && (
            <button
              type="button"
              onClick={act.onDelete}
              className={SESSION_PILL}
              style={SESSION_PILL_DANGER_STYLE}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {(onOpenActivity || stravaUrl || canFetchMore || !!act.activityId) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onOpenActivity && (
            <button
              type="button"
              onClick={() => onOpenActivity(act.activityId)}
              className={SESSION_PILL}
              style={SESSION_PILL_STYLE}
            >
              Otvoriť aktivitu
            </button>
          )}

          {stravaUrl && (
            <Button
              type="button"
              variant="viewOnStrava"
              size="sm"
              onClick={openStrava}
              title="View on Strava"
            >
              View on Strava
            </Button>
          )}

          {canFetchMore && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onFetchMore}
              disabled={busyFetch}
              title="Fetch missing details from Strava and cache for a limited time"
            >
              {busyFetch ? "Loading…" : "Load more data"}
            </Button>
          )}
        </div>
      )}

      {showOverview && (
        <ActivitySectionShell
          title="Prehľad"
          defaultOpen={true}
          items={overviewItems}
        />
      )}

      {/* ✅ Coach komentár */}
      {!!act.activityId && (
        <ActivityCoachReviewSection
          item={act}
          activityId={Number(act.activityId)}
        />
      )}

      {/* ✅ HR + Zones Section */}
      {showHr && (
        <ActivitySectionShell title="Heart rate" items={hrItems}>
          {/* 1. Pie Chart ak máme dáta zo zón */}
          {hasZones && enrichment && (
            <div className="mb-4 border-b border-white/5 pb-4">
              <div className="text-[10px] uppercase font-bold opacity-50 mb-2">
                Zones distribution
              </div>
              <PieTrend items={zoneItems} valueFormatter={fmtTime} />
            </div>
          )}

          {/* 2. Stream chart */}
          {hasStreams && (
            <ActivityStreamCharts
              streams={streams}
              compact={compactChart}
              metric="hr"
              sportHint={sportHint}
            />
          )}
        </ActivitySectionShell>
      )}

      {showElev && (
        <ActivitySectionShell title="Elevácia & kadencia" items={elevItems}>
          {hasStreams && (
            <ActivityStreamCharts
              streams={streams}
              compact={compactChart}
              metric="elevation"
              sportHint={sportHint}
            />
          )}

          {hasCadStream && (
            <div className="mt-4">
              <ActivityStreamCharts
                streams={streams}
                compact={compactChart}
                metric="cadence"
                sportHint={sportHint}
              />
            </div>
          )}
        </ActivitySectionShell>
      )}

      {showPower && (
        <ActivitySectionShell title="Rýchlosť & výkon" items={powerItems}>
          {hasStreams && (
            <ActivityStreamCharts
              streams={streams}
              compact={compactChart}
              metric="power"
              sportHint={sportHint}
            />
          )}
        </ActivitySectionShell>
      )}

      {showEnv && (
        <ActivitySectionShell
          title="Prostredie & štatistiky"
          items={envItems}
        />
      )}

      {hasSplits && (
        <ActivitySectionShell title="Splits">
          <ActivitySplitsSection kind={splits} />
        </ActivitySectionShell>
      )}

      {hasLaps && (
        <ActivitySectionShell title="Laps">
          <ActivitySplitsSection kind={laps} />
        </ActivitySectionShell>
      )}

      {act.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(act.notes)}</div>
      )}
    </div>
  );
}