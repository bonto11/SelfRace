// src/app/features/coach/components/DetailMonthlySummary.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetMonthlySummary,
  type MonthlySummary,
  type SportStat,
} from "@/app/features/activities/api/monthly_summary";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─── FORMÁTOVACIE HELPERY ─── */
function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
function fmtDist(meters: number): string {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}
function fmtPace(mps: number): string {
  const secPerKm = 1000 / mps;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}
function fmtSpeed(mps: number): string {
  return `${(mps * 3.6).toFixed(1)} km/h`;
}
function monthName(month: number): string {
  return new Date(2024, month - 1, 1).toLocaleString("sk-SK", { month: "long" });
}

/* ─── SPORT CONFIG ─── */
const SPORT_LABEL: Record<string, string> = {
  run:      "🏃 Beh",
  ride:     "🚴 Bicykel",
  swim:     "🏊 Plávanie",
  strength: "💪 Posilka",
  mixed:    "⚡ Zmiešané",
  walk:     "🚶 Chôdza",
  other:    "▪ Iné",
};
const SPORT_HAS_PACE  = new Set(["run", "mixed"]);
const SPORT_HAS_SPEED = new Set(["ride", "swim"]);
const SPORT_HAS_DIST  = new Set(["run", "ride", "swim", "mixed"]);
const SPORT_ORDER     = ["run", "ride", "swim", "mixed", "strength", "walk", "other"];

/* ─── ZONE CONFIG ─── */
const ZONE_COLOR: Record<string, string> = {
  z1: "#64d8a2", z2: "#4ade80", z3: "#facc15", z4: "#fb923c", z5: "#f87171",
};

/* ─── UI PRIMITÍVY ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginTop: 12 }}>
      <div style={{ padding: "14px 16px 6px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>{title}</div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "9px 16px", borderBottom: `1px solid ${appColors.divider}`,
    }}>
      <span style={{ fontSize: 13, color: appColors.textMuted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>{value}</span>
    </div>
  );
}

/* ─── SPORT KARTA ─── */
function SportCard({ sport, stat, t }: { sport: string; stat: SportStat; t: any }) {
  const label    = SPORT_LABEL[sport] ?? `▪ ${sport}`;
  const hasDist  = SPORT_HAS_DIST.has(sport)  && (stat.total_dist_m ?? 0) > 0;
  const hasPace  = SPORT_HAS_PACE.has(sport)  && !!stat.avg_speed_mps;
  const hasSpeed = SPORT_HAS_SPEED.has(sport) && !!stat.avg_speed_mps;

  return (
    <div style={{
      margin: "0 12px 12px",
      borderRadius: 12,
      border: `1px solid ${appColors.panelBorder}`,
      backgroundColor: "rgba(255,255,255,0.02)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderBottom: `1px solid ${appColors.panelBorder}`,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textPrimary }}>{label}</span>
        <span style={{ fontSize: 12, color: appColors.textMuted }}>{stat.count}×</span>
      </div>

      <Row label={t("monthlySummary.sport.totalTime") as any}  value={fmtTime(stat.total_time_s)} />
      {hasDist  && <Row label={t("monthlySummary.sport.totalDist") as any}  value={fmtDist(stat.total_dist_m!)} />}
      {hasPace  && <Row label={t("monthlySummary.sport.avgPace") as any}    value={fmtPace(stat.avg_speed_mps!)} />}
      {hasSpeed && <Row label={t("monthlySummary.sport.avgSpeed") as any}   value={fmtSpeed(stat.avg_speed_mps!)} />}
      <Row label={t("monthlySummary.sport.avgSession") as any}  value={fmtTime(stat.avg_time_s)} />
      <Row label={t("monthlySummary.sport.longest") as any}     value={fmtTime(stat.longest_s)} />
    </div>
  );
}

/* ─── ZÓNY ─── */
function ZoneBar({ zones }: { zones: Record<string, number> }) {
  const total = Object.values(zones).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const keys = (["z1", "z2", "z3", "z4", "z5"] as const).filter((k) => (zones[k] ?? 0) > 0);

  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {keys.map((z) => (
          <div key={z} style={{ flex: zones[z] / total, backgroundColor: ZONE_COLOR[z], opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
        {keys.map((z) => (
          <div key={z} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: ZONE_COLOR[z] }} />
            <span style={{ fontSize: 11, color: appColors.textMuted }}>
              {z.toUpperCase()} {fmtTime(zones[z] * 60)} ({Math.round((zones[z] / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MESIAC NAVIGÁCIA ─── */
function MonthNav({ year, month, onChange }: {
  year: number; month: number;
  onChange: (y: number, m: number) => void;
}) {
  const now = new Date();
  const isNow = year === now.getFullYear() && month === now.getMonth() + 1;

  const prev = () => month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1);
  const next = () => { if (!isNow) month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1); };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 16px" }}>
      <button onClick={prev} style={{ background: "none", border: "none", cursor: "pointer", color: appColors.textMuted, fontSize: 22, padding: "4px 10px" }}>‹</button>
      <span style={{ fontSize: 15, fontWeight: 600, color: appColors.textPrimary }}>
        {monthName(month)} {year}
      </span>
      <button onClick={next} disabled={isNow} style={{ background: "none", border: "none", cursor: isNow ? "default" : "pointer", color: isNow ? "transparent" : appColors.textMuted, fontSize: 22, padding: "4px 10px" }}>›</button>
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function DetailMonthlySummary() {
  const { userId } = useUserId();
  const t = useT();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlySummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    apiGetMonthlySummary(userId, year, month)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => console.error("[MonthlySummaryDetail]", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, year, month]);

  const allSports = [
    ...SPORT_ORDER.filter((s) => data?.sport_stats[s] && data.sport_stats[s].total_time_s > 0),
    ...Object.keys(data?.sport_stats ?? {}).filter((s) => !SPORT_ORDER.includes(s) && (data?.sport_stats[s].total_time_s ?? 0) > 0),
  ];

  const rec      = data?.recovery;
  const zones    = data?.zones_min ?? {};
  const hasZones = Object.values(zones).some((v) => (v ?? 0) > 0);

  return (
    <>
      <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <LoadingSpinner size="trend" />
        </div>
      ) : !data || data.summary.total_sessions === 0 ? (
        <section className={CARD} style={SURFACE_CARD_STYLE}>
          <p style={{ padding: 20, textAlign: "center", color: appColors.textMuted, fontSize: 14 }}>
            {t("monthlySummary.noData") as any}
          </p>
        </section>
      ) : (
        <>
          {/* Celkový súhrn */}
          <Section title={t("monthlySummary.overallTitle") as any}>
            <Row label={t("monthlySummary.totalSessions") as any} value={String(data.summary.total_sessions)} />
            <Row label={t("monthlySummary.totalTime") as any}     value={fmtTime(data.summary.total_time_s)} />
            {data.summary.total_dist_m > 0 && (
              <Row label={t("monthlySummary.totalDist") as any} value={fmtDist(data.summary.total_dist_m)} />
            )}
          </Section>

          {/* Podľa sportu */}
          {allSports.length > 0 && (
            <Section title={t("monthlySummary.bySportTitle") as any}>
              <div style={{ height: 6 }} />
              {allSports.map((s) => (
                <SportCard key={s} sport={s} stat={data.sport_stats[s]} t={t} />
              ))}
            </Section>
          )}

          {/* Tepové zóny */}
          {hasZones && (
            <Section title={t("monthlySummary.zonesTitle") as any}>
              <ZoneBar zones={zones as Record<string, number>} />
            </Section>
          )}

          {/* Regenerácia */}
          {rec && rec.days_recorded > 0 && (
            <Section title={t("monthlySummary.recoveryTitle") as any}>
              <Row label={t("monthlySummary.daysRecorded") as any}   value={String(rec.days_recorded)} />
              {rec.avg_hrv_ms        != null && <Row label="HRV"                                             value={`${rec.avg_hrv_ms} ms`} />}
              {rec.avg_rhr_bpm       != null && <Row label="RHR"                                             value={`${rec.avg_rhr_bpm} bpm`} />}
              {rec.avg_sleep_duration_min != null && <Row label={t("monthlySummary.avgSleep") as any}        value={fmtTime(rec.avg_sleep_duration_min * 60)} />}
              {rec.avg_sleep_start   != null && <Row label={t("monthlySummary.avgSleepStart") as any}        value={rec.avg_sleep_start} />}
            </Section>
          )}
        </>
      )}
    </>
  );
}