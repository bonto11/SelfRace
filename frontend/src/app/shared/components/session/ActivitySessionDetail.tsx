"use client";

import { useState, useEffect, type ReactNode, type CSSProperties, useMemo } from "react";
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
import { toast } from "@/app/shared/ui/components/Toast";
import Button from "@/app/shared/ui/components/Button";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { ActivityStreamCharts } from "@/app/shared/components/trend/StreamCharts";
import { StreamsData } from "@/app/features/activities/types/activities";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { ActivitySplitsSection } from "./ActivitySplitsSection";

import { getStravaActivityUrl } from "@/app/features/strava/utils/links";
import { useUserId } from "@/app/shared/hooks/useUserId";

import ActivityCoachReviewSection from "./ActivityReviewSection";
import {
  PieTrend,
  type PieTrendItem,
} from "@/app/shared/components/trend/PieTrend";
import type{  ActivityEnrichment } from "@/app/features/activities/types/activities_enrichment";
import { useT } from "@/app/shared/i18n/useT";

import { apiFetchActivityExtrasCombined } from "@/app/features/activities/api/analytics_activities";

// ✅ Nový import modalu (ktorý vytvoríme v kroku 2)
import ActivityShareModal from "./ActivityShareModal";

function fmtTime(min: number) {
  if (min < 1) return "<1m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type InfoItem = { label: string; value: string | number | null };

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function safeText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function isMeaningfulNumber(n: any, { allowZero = false } = {}): n is number {
  if (n == null) return false;
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return false;
  if (!allowZero && x === 0) return false;
  return true;
}

function formatCadenceSummary(s: any | null, t: any): string | null {
  if (!s || s.average_cadence_rpm == null) return null;
  const sport = (s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? "").toString().toLowerCase();
  const rpm = s.average_cadence_rpm;
  if (sport.includes("bike") || sport.includes("ride") ) 
    return `${rpm} ${t("common.units.kadenceBike")}`;
  return `${Math.round(rpm * 2)} ${t("common.units.kadenceRun")}`;
}

function formatPaceFromSpeedMps(speed: number | null | undefined, t: any): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds} ${t("common.units.pace")}`;
}

function zoneColor(zoneNum: number) {
  const { z1, z2, z3, z4, z5 } = CHART_HR.colors;
  if (zoneNum === 1) return z1;
  if (zoneNum === 2) return z2;
  if (zoneNum === 3) return z3;
  if (zoneNum === 4) return z4;
  return z5;
}

type SectionProps = { title: string; defaultOpen?: boolean; items?: InfoItem[]; children?: ReactNode };

const INLINE_WRAP_CLASS = [SURFACE_INLINE, "px-0 py-0 overflow-hidden"].join(" ");
const INFO_TILE_CLASS = "rounded-xl border px-3 py-2 flex flex-col justify-center shadow-sm";
const INFO_TILE_STYLE: CSSProperties = { background: appColors.backgroundAlt, borderColor: appColors.surfaceCardBorder };

export function ActivitySectionShell({ title, defaultOpen, items, children }: SectionProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hasItems = items && items.some(it => it.value != null && it.value !== "—");
  if (!hasItems && !children) return null;

  return (
    <section className="mt-4">
      <div className={INLINE_WRAP_CLASS} style={SURFACE_INLINE_STYLE}>
        <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold tracking-tight hover:bg-white/5 transition-colors">
          <span className="min-w-0">{title}</span>
          <span className={`text-base opacity-50 leading-none transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        {open && (
          <div className={[SESSION_DIVIDER, "px-4 py-4 text-sm"].join(" ")} style={SESSION_DIVIDER_STYLE}>
            {hasItems && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {items!.map(t => (
                  <div key={t.label} className={INFO_TILE_CLASS} style={INFO_TILE_STYLE}>
                    <div className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-0.5">{t.label}</div>
                    <div className="text-[15px] font-semibold tabular-nums text-white/90">{valOrDash(t.value)}</div>
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

export function ActivitySessionDetail({ item, compactChart, onOpenActivity }: any) {
  const act = item;
  const t = useT();
  const { userId } = useUserId();
  const { getSummary, getExtras, getEnrichment } = useActivityData() as any;

  const s = act.activityId != null ? getSummary(act.activityId) : null;
  const distTxt = s ? formatDistance(s.distance_m ?? null) : act.distanceStr ?? "—";
  const timeTxt = s && s.moving_time_s != null ? fmtSecondsHMS(s.moving_time_s) : act.timeStr ?? "—";
  const avgHrTxt = s ? s.average_heartrate_bpm ?? "—" : act.avgHr ?? "—";
  const maxHrTxt = s ? s.max_heartrate_bpm ?? "—" : act.maxHr ?? "—";
  const cadenceLabel = formatCadenceSummary(s, t);
  const paceLabel = formatPaceFromSpeedMps(s?.average_speed_mps, t);
  const powerTxt = s?.average_watts ? `${Math.round(s.average_watts)} W` : null;
  const sportHint = (s?.sport_type_ovrd ?? s?.sport_type_fe ?? s?.sport_type ?? act.sport ?? "") as string;
  const stravaActivityId = s?.activity_id ?? s?.id ?? null; // ID priamo zo Stravy
  const stravaUrl = stravaActivityId ? getStravaActivityUrl(stravaActivityId) : null;

  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0, cadence_rpm: [], power_w: [], distance_m: [], altitude_m: [] });
  const [splits, setSplits] = useState<any[]>([]);
  const [enrichment, setEnrichment] = useState<ActivityEnrichment | null>(null);
  
  const [isFetchingDetailed, setIsFetchingDetailed] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  // ✅ State pre Share Modal
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Zistíme, či vôbec existujú hrubé dáta (aj keby to boli nuly). 
  // Toto rozhoduje o tom, či schováme tlačidlo "Načítať zo Stravy".
  const hasRawStreams = Array.isArray(streams.time_s) && streams.time_s.length > 0;
  const hasSplits = Array.isArray(splits) && splits.length > 1;

  // Vyčistíme streamy, aby sme do grafov neposielali polia plné núl
  const cleanedStreams = useMemo(() => {
    if (!streams.time_s || streams.time_s.length === 0) return streams;

    const out = { ...streams };

    const hasData = (arr: (number | null)[] | undefined) => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(val => val !== null && val !== 0);
    };

    if (!hasData(out.altitude_m)) out.altitude_m = [];
    if (!hasData(out.distance_m)) out.distance_m = [];
    if (!hasData(out.cadence_rpm)) out.cadence_rpm = [];
    if (!hasData(out.power_w)) out.power_w = [];
    if (!hasData(out.hr)) out.hr = [];

    return out;
  }, [streams]);

  // Toto použijeme pre zobrazenie GRAFOV
  const hasValidStreamsForChart = cleanedStreams.time_s && cleanedStreams.time_s.length > 0;

  useEffect(() => {
    if (!act.activityId) return;
    let alive = true;
    
    const loadInitialData = async () => {
      try {
        const [extras, enr] = await Promise.all([getExtras(act.activityId), getEnrichment(act.activityId)]);
        if (!alive) return;

        if (extras?.streams) setStreams(extras.streams);
        if (extras?.splits) setSplits(extras.splits);
        if (enr) setEnrichment(enr);
      } catch (e) {
        console.error("Failed to load initial extras", e);
      } finally {
        if (alive) setInitialLoadDone(true);
      }
    };
    
    loadInitialData();
    return () => { alive = false; };
  }, [act.activityId, getExtras, getEnrichment]);

  // Funkcia na manuálne stiahnutie dát zo Stravy
  const handleFetchDetailedData = async () => {
    if (!userId || !act.activityId || isFetchingDetailed) return;
    
    setIsFetchingDetailed(true);

    try {
      const result = await apiFetchActivityExtrasCombined(Number(userId), act.activityId, true);
      
      if (result) {
        if (result.streams) setStreams(result.streams);
        if (result.splits) setSplits(result.splits);
      }
    } catch (e: any) {
      console.error("Chyba pri sťahovaní zo Stravy:", e);
      toast.error(t(e?.message as any) || t("api.activities.extrasFetchFailed"));
    } finally {
      setIsFetchingDetailed(false);
    }
  };

  const allKpis: InfoItem[] = [
    { label: t("common.metrics.time"), value: timeTxt },
    { label: t("common.metrics.distance"), value: distTxt },
    isMeaningfulNumber(avgHrTxt) ? { label: t("common.metrics.hr_avg"), value: avgHrTxt } : null,
    isMeaningfulNumber(maxHrTxt) ? { label: t("common.metrics.hr_max"), value: maxHrTxt } : null,
    paceLabel ? { label: t("common.metrics.pace"), value: paceLabel } : null,
    powerTxt ? { label: t("common.metrics.power"), value: powerTxt } : null,
    cadenceLabel ? { label: t("sessions.splits.colCadence"), value: cadenceLabel } : null,
    s?.elevation_gain_m ? { label: t("sessions.splits.colElev"), value: `${s.elevation_gain_m} m` } : null,
  ].filter(Boolean) as InfoItem[];

  const zoneItems: PieTrendItem[] = [
    { label: "Z1", value: enrichment?.z1_min || 0, color: zoneColor(1) },
    { label: "Z2", value: enrichment?.z2_min || 0, color: zoneColor(2) },
    { label: "Z3", value: enrichment?.z3_min || 0, color: zoneColor(3) },
    { label: "Z4", value: enrichment?.z4_min || 0, color: zoneColor(4) },
    { label: "Z5", value: enrichment?.z5_min || 0, color: zoneColor(5) },
  ];

  return (
    <div className="pb-4">
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* ✅ Tlačidlo Zdieľať (Primary) */}
        <Button 
          type="button" 
          variant="primary" 
          size="sm" 
          onClick={() => setIsShareOpen(true)}
        >
          {t("sessions.detail.btnShare" as any) || "Zdieľať"}
        </Button>

        {/* Správne použitý Button komponent pre Stravu */}
        {stravaUrl && (
          <Button type="button" variant="viewOnStrava" size="sm" onClick={() => window.open(stravaUrl, "_blank")}>
            {t("sessions.detail.btnStrava")}
          </Button>
        )}

        {act.onToggleFavorite && (
          <button type="button" onClick={act.onToggleFavorite} className={SESSION_PILL} style={act.isFavorite ? SESSION_PILL_ACTIVE_STYLE : SESSION_PILL_STYLE}>
            {act.isFavorite ? `★ ${t("sessions.detail.btnFavoriteUnset")}` : `☆ ${t("sessions.detail.btnFavoriteSet")}`}
          </button>
        )}
        {act.onEdit && <button type="button" onClick={act.onEdit} className={SESSION_PILL} style={SESSION_PILL_STYLE}>{t("common.edit")}</button>}
        {act.onDelete && <button type="button" onClick={act.onDelete} className={SESSION_PILL} style={SESSION_PILL_DANGER_STYLE}>{t("common.delete")}</button>}
        {onOpenActivity && <button type="button" onClick={() => onOpenActivity(act.activityId)} className={SESSION_PILL} style={SESSION_PILL_STYLE}>{t("calendar.openActivity")}</button>}
        
        {/* Tlačidlo "Načítať podrobné dáta" */}
        {initialLoadDone && stravaActivityId && !hasRawStreams && (
          <Button 
            type="button" 
            variant="secondary" 
            size="sm" 
            onClick={handleFetchDetailedData} 
            disabled={isFetchingDetailed}
          >
            {isFetchingDetailed ? t("common.loading") : t("sessions.detail.btnMoreData" as any)}
          </Button>
        )}
      </div>

      <ActivitySectionShell title={t("sessions.detail.sectionOverview")} defaultOpen={true} items={allKpis}>
        {enrichment && (
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="text-xs uppercase font-bold opacity-60 mb-6 px-1">{t("sessions.detail.zonesDistribution")}</div>
            <div className="bg-black/10 rounded-xl p-4 border border-white/5">
                <PieTrend items={zoneItems} valueFormatter={fmtTime} />
            </div>
          </div>
        )}
      </ActivitySectionShell>
      
      {!!act.activityId && <ActivityCoachReviewSection item={act} activityId={Number(act.activityId)} />}

      {hasValidStreamsForChart && (
        <ActivitySectionShell title={t("sessions.charts.stream.title" as any)} defaultOpen={false}>
           <ActivityStreamCharts streams={cleanedStreams} compact={compactChart} sportHint={sportHint} />
        </ActivitySectionShell>
      )}

      {hasSplits && (
        <ActivitySectionShell title={t("sessions.detail.sectionSplits")}>
          <ActivitySplitsSection kind={splits} />
        </ActivitySectionShell>
      )}

      {act.notes && (
        <div className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5 text-sm text-white/80 leading-relaxed">
          {safeText(act.notes)}
        </div>
      )}

      {/* ✅ Modal pre Zdieľanie */}
      {isShareOpen && (
        <ActivityShareModal 
          isOpen={isShareOpen} 
          onClose={() => setIsShareOpen(false)}
          activity={act}
          summary={s} // Posielame aj summary dáta pre štatistiky
        />
      )}
    </div>
  );
}
