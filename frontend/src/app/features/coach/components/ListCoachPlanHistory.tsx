"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { apiGetCoachPlanHistory } from "@/app/features/coach/api/coach_plan_active";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

function formatDate(isoString: string | null) {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function ListCoachPlanHistory() {
  const { userId } = useUserId();
  const t = useT();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiGetCoachPlanHistory(userId);
        if (alive) setHistory(data);
      } catch (err: any) {
        if (alive) setError(err.message || "Failed to load history.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner size="widget" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  if (history.length === 0) {
    return (
      <div className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "text-center opacity-70"].join(" ")}>
          {t("coachPlan.history.empty" as any) || "Zatiaľ nemáš žiadne ukončené plány."}
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_STACK}>
      {history.map((plan) => {
        const stats = plan.final_stats || {};
        const planned = stats.final_planned_stats || {};
        const actual = stats.final_actual_stats || {};
        
        const isCompleted = plan.status === "completed";
        const statusColor = isCompleted ? appColors.statusSuccess : appColors.statusError;
        const statusLabel = isCompleted ? "Úspešne dokončené" : "Zrušené";

        return (
          <section key={plan.id} className={SESSION_CARD} style={SESSION_CARD_STYLE}>
            <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
              <div className="flex justify-between items-start w-full">
                <div>
                  <div className={PANEL_SECTION_TITLE}>
                    {plan.main_sport ? plan.main_sport.toUpperCase() : "Tréningový Plán"}
                  </div>
                  <div className={PANEL_SECTION_SUBTITLE}>
                    {formatDate(plan.start_date)} – {formatDate(plan.end_date)}
                  </div>
                </div>
                <div 
                  className="px-2 py-1 text-xs font-bold rounded"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {statusLabel}
                </div>
              </div>
            </header>

            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              {/* Celkové info o týždňoch */}
              <div className={PANEL_PREVIEW}>
                Odtrénované: <strong className="text-white">{stats.weeks_tracked || 0}</strong> z {plan.weeks_total || stats.weeks_total_planned || "?"} týždňov
              </div>

              {/* Štatistiky Grid */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {/* Beh / Hlavný šport - Vzdialenosť */}
                {planned.run_distance_km > 0 && (
                  <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
                    <div className="p-3">
                      <div className={PANEL_SECTION_SUBTITLE}>Nabehané (km)</div>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-bold">{actual.run_distance_km || 0}</span>
                        <span className="text-sm opacity-50 mb-1">/ {planned.run_distance_km}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Beh / Hlavný šport - Čas */}
                {planned.run_time_min > 0 && (
                  <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
                    <div className="p-3">
                      <div className={PANEL_SECTION_SUBTITLE}>Čas v pohybe (hod)</div>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-bold">{((actual.run_time_min || 0) / 60).toFixed(1)}</span>
                        <span className="text-sm opacity-50 mb-1">/ {((planned.run_time_min || 0) / 60).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sila - Čas */}
                {planned.strength_time_min > 0 && (
                  <div className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
                    <div className="p-3">
                      <div className={PANEL_SECTION_SUBTITLE}>Silový tréning (hod)</div>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-bold">{((actual.strength_time_min || 0) / 60).toFixed(1)}</span>
                        <span className="text-sm opacity-50 mb-1">/ {((planned.strength_time_min || 0) / 60).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={ACCORDION_FOOTER_BAR_MUTED} />
          </section>
        );
      })}
    </div>
  );
}
