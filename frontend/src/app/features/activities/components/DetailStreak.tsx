// src/app/features/coach/components/StreakDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetStreak, type StreakData } from "@/app/features/activities/api/analytics_activities";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─── HELPERS ─── */
function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
function fmtDist(meters: number): string {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

const SPORT_LABEL: Record<string, string> = {
  run:      "🏃 Beh",
  ride:     "🚴 Bicykel",
  swim:     "🏊 Plávanie",
  strength: "💪 Posilka",
  mixed:    "⚡ Zmiešané",
  other:    "▪ Iné",
};
// Športy kde zobrazíme vzdialenosť
const HAS_DISTANCE = new Set(["run", "ride", "swim", "mixed"]);

// Poradie zobrazenia
const SPORT_ORDER = ["run", "ride", "swim", "mixed", "strength", "other"];

/* ─── SPORT ROW ─── */
function SportRow({ sport, timeS, distM }: { sport: string; timeS: number; distM: number | null }) {
  const label = SPORT_LABEL[sport] ?? `▪ ${sport}`;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 16px", borderBottom: `1px solid ${appColors.divider}`,
    }}>
      <span style={{ fontSize: 13, color: appColors.textMuted }}>{label}</span>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
          {fmtTime(timeS)}
        </span>
        {distM !== null && distM > 0 && (
          <span style={{ fontSize: 12, color: appColors.textMuted }}>
            {fmtDist(distM)}
          </span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, backgroundColor: color }} />
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function DetailStreak() {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StreakData | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetStreak(userId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => console.error("[StreakDetail]", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <LoadingSpinner size="trend" />
    </div>
  );

  const current = data?.current_streak ?? 0;
  const best    = data?.best_streak ?? 0;
  const done    = data?.this_week_done ?? 0;
  const minSess = data?.min_sessions_per_week ?? 3;
  const sports  = (data as any)?.sport_stats ?? {};

  const streakColor = current === 0 ? appColors.textMuted
    : current >= 4 ? "#f97316" : "#4ade80";
  const weekColor   = done >= minSess ? "#4ade80"
    : done >= 1 ? appColors.stateWarning : appColors.textMuted;

  // Zotriedené a nenulové športy
  const sportEntries = SPORT_ORDER
    .filter((s) => sports[s] && sports[s].time_s > 0)
    .map((s) => ({ sport: s, ...sports[s] }));

  // Aj neznáme športy čo nie sú v SPORT_ORDER
  const unknownSports = Object.entries(sports)
    .filter(([s, v]: any) => !SPORT_ORDER.includes(s) && v.time_s > 0)
    .map(([s, v]: any) => ({ sport: s, ...v }));

  const allSports = [...sportEntries, ...unknownSports];

  return (
    <>
      {/* Streak karta */}
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        <div style={{ textAlign: "center", padding: "24px 16px 16px" }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{current > 0 ? "🔥" : "💤"}</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: streakColor, marginTop: 4 }}>{current}</div>
          <div style={{ fontSize: 14, color: appColors.textMuted, marginTop: 4 }}>
            {current === 1
              ? t("streak.detail.week") as any
              : t("streak.detail.weeks") as any}
          </div>
        </div>

        {/* Rekord */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 16px", borderBottom: `1px solid ${appColors.divider}`,
        }}>
          <span style={{ fontSize: 13, color: appColors.textMuted }}>
            {t("streak.detail.bestStreak") as any}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: appColors.textMuted }}>
            {best} {t("streak.detail.weeksUnit") as any}
          </span>
        </div>

        {/* Tento týždeň */}
        <div style={{ padding: "10px 16px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: appColors.textMuted }}>
              {t("streak.detail.thisWeek") as any}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: weekColor }}>
              {done} / {minSess}
            </span>
          </div>
          <ProgressBar value={done} max={minSess} color={weekColor} />
          {done < minSess && (
            <p style={{ fontSize: 11, color: appColors.textMuted, marginTop: 6, opacity: 0.7 }}>
              {t("streak.detail.needMore") as any}{" "}{minSess - done}{" "}
              {t("streak.detail.sessionsLeft") as any}
            </p>
          )}
        </div>
        <div style={{ height: 8 }} />
      </section>

      {/* Štatistiky podľa sportu */}
      {allSports.length > 0 && (
        <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginTop: 12 }}>
          <div style={{ padding: "14px 16px 4px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
              {t("streak.detail.statsTitle") as any}
            </div>
          </div>
          {allSports.map(({ sport, time_s, dist_m }) => (
            <SportRow
              key={sport}
              sport={sport}
              timeS={time_s}
              distM={HAS_DISTANCE.has(sport) ? (dist_m ?? 0) : null}
            />
          ))}
        </section>
      )}
    </>
  );
}