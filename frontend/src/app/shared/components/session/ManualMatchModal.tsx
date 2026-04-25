// src/app/features/coach/components/ManualMatchModal.tsx
"use client";

import { useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { toast } from "@/app/shared/ui/components/Toast";
import { apiPatchDailySessionStatus } from "@/app/features/coach/api/coach_plan_daily";

import Button from "@/app/shared/ui/components/Button";
import SportBadge from "@/app/shared/ui/components/SportBadge";
import type { DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";

type ManualMatchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: DailyPlanSession | null;
};

export default function ManualMatchModal({
  isOpen,
  onClose,
  onSuccess,
  session,
}: ManualMatchModalProps) {
  const t = useT();
  const { userId } = useUserId();
  const { rows: activities } = useActivityData();

  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vytiahneme posledných 15 aktivít a zoradíme ich od najnovšej
  const recentActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    return [...activities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [activities]);

  if (!isOpen || !session) return null;

  const handleMatch = async () => {
    if (!userId || !session.id || !selectedActivityId) return;

    setIsSaving(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(session.id), {
        activity_id: selectedActivityId,
      });
      
      toast.success(t("sessions.matchModal.success"));
      onSuccess(); 
      onClose();
    } catch (error) {
      toast.error(t("sessions.matchModal.error"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDistance = (meters?: number | null) => {
    if (!meters) return null;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds?: number | null) => {
    if (!seconds) return null;
    return `${Math.round(seconds / 60)} min`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#121212] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Hlavička modalu */}
        <div className="p-5 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-bold text-white">
            {t("sessions.matchModal.title")}
          </h3>
          <p className="text-sm opacity-60 mt-1">
            {t("sessions.matchModal.subtitle")}
          </p>
          <div className="mt-2 text-emerald-400 font-semibold text-sm">
            {session.title}
          </div>
        </div>

        {/* Zoznam aktivít */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {recentActivities.length === 0 ? (
            <div className="text-center text-sm opacity-50 py-8">
              {t("sessions.matchModal.noActivities")}
            </div>
          ) : (
            recentActivities.map((act) => {
              const isSelected = selectedActivityId === act.activity_id;
              const dist = formatDistance(act.distance_m);
              const time = formatTime(act.moving_time_s);
              const metrics = [dist, time].filter(Boolean).join(" · ");

              return (
                <button
                  key={act.activity_id}
                  onClick={() => setSelectedActivityId(act.activity_id)}
                  className={`w-full flex items-center gap-4 text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="shrink-0">
                    <SportBadge sport={act.sport_type_fe || act.sport_type || "other"} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {act.name}
                    </div>
                    <div className="text-xs opacity-60 mt-0.5 flex justify-between">
                      <span>{formatDate(act.date)}</span>
                      {metrics && <span>{metrics}</span>}
                    </div>
                  </div>

                  {/* Vizuálny indikátor výberu */}
                  <div className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors">
                    {isSelected ? (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Akčné tlačidlá (pätička) */}
        <div className="p-5 border-t border-white/10 shrink-0 flex justify-end gap-3 bg-white/5">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {t("sessions.matchModal.btnCancel")}
          </Button>
          
          <Button
            variant="primary"
            onClick={handleMatch}
            disabled={!selectedActivityId || isSaving}
          >
            {isSaving ? t("sessions.matchModal.btnSaving") : t("sessions.matchModal.btnMatch")}
          </Button>
        </div>
      </div>
    </div>
  );
}