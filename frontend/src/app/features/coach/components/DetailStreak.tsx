// src/app/features/coach/components/StreakDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetStreak, type StreakData } from "@/app/features/coach/api/coach_plan_daily";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 16px", borderBottom: `1px solid ${appColors.divider}`,
    }}>
      <span style={{ fontSize: 13, color: appColors.textMuted }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: color || appColors.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, backgroundColor: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

export default function StreakDetail() {
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
  const minDur  = data?.min_duration_min ?? 20;

  const streakColor = current === 0 ? appColors.textMuted
    : current >= 4 ? "#f97316" : "#4ade80";
  const weekColor   = done >= minSess ? "#4ade80"
    : done >= 1 ? appColors.stateWarning : appColors.textMuted;

  const weeksLabel = current === 1
    ? t("streak.detail.week") as any
    : t("streak.detail.weeks") as any;

  return (
    <>
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        <div style={{ textAlign: "center", padding: "24px 16px 16px" }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{current > 0 ? "🔥" : "💤"}</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: streakColor, marginTop: 4 }}>{current}</div>
          <div style={{ fontSize: 14, color: appColors.textMuted, marginTop: 4 }}>
            {weeksLabel}
          </div>
        </div>

        <StatRow
          label={t("streak.detail.bestStreak") as any}
          value={`${best} ${t("streak.detail.weeksUnit") as any}`}
          color={appColors.textMuted}
        />
        <StatRow
          label={t("streak.detail.thisWeek") as any}
          value={`${done} / ${minSess}`}
          color={weekColor}
        />

        <div style={{ padding: "10px 16px 16px" }}>
          <ProgressBar value={done} max={minSess} color={weekColor} />
          {done < minSess && (
            <p style={{ fontSize: 11, color: appColors.textMuted, marginTop: 6, opacity: 0.7 }}>
              {t("streak.detail.needMore") as any}{" "}
              {minSess - done}{" "}
              {t("streak.detail.sessionsLeft") as any}
            </p>
          )}
        </div>
      </section>

      <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginTop: 12 }}>
        <div style={{ padding: "14px 16px 4px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
            {t("streak.detail.rulesTitle") as any}
          </div>
        </div>
        <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            `✅ ${(t("streak.detail.rule1") as any).replace("{{n}}", String(minSess))}`,
            `⏱ ${(t("streak.detail.rule2") as any).replace("{{min}}", String(minDur))}`,
            `📅 ${t("streak.detail.rule3") as any}`,
            `💔 ${t("streak.detail.rule4") as any}`,
          ].map((rule, i) => (
            <p key={i} style={{ fontSize: 13, color: appColors.textMuted, margin: 0 }}>{rule}</p>
          ))}
        </div>
      </section>
    </>
  );
}