// src/app/activities/page.tsx (alebo kde ju máš)

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserId } from "@/shared/hooks/useUserId";
import { resetClientCache } from "@/shared/utils/resetClientCache";
import { toast } from "@/shared/components/ui/Toast";
import Button from "@/shared/components/ui/Button";
import { apiSyncActivities } from "@/features/activities/api/synchronization";
import { SyncActivitiesStats } from "@/features/activities/types/synchronization";
import WeeklyLoadWidget from "@/shared/components/widgets/WidgetWeeklyLoad";
import MonoStrainWidget from "@/shared/components/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/shared/components/widgets/WidgetPareto8020";
import WidgetActivitiesCalendar from "@/shared/components/widgets/WidgetActivitiesCalendar";

export default function ActivitiesPage() {
  const { userId } = useUserId();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!userId || syncing) return;
    setSyncing(true);
    try {
      // 🔹 používame iba apiSyncActivities – žiadny priamy fetch
      const stats: SyncActivitiesStats = await apiSyncActivities(userId, {
        forceLastDays: 30,
        fetchDetails: true,
      });

      const imp = stats.imported ?? 0;
      const upd = stats.updated ?? 0;
      const skp = stats.skipped ?? 0;

      toast.success(
        `✅ Sync OK • imported: ${imp} • updated: ${upd} • skipped: ${skp}`
      );

      resetClientCache();
    } catch (e: any) {
      toast.error(
        `❌ Sync error: ${e?.message || e || "unknown error during sync"}`
      );
    } finally {
      setSyncing(false);
    }
  }, [userId, syncing]);

  const openDetailLoad = () => router.push("/activities/load");
  const openDetailMono = () => router.push("/activities/mono");
  const openDetail8020 = () => router.push("/activities/pareto");

  return (
    <>
      <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="max-w-screen-lg mx-auto flex items-center gap-3">
          <h1 className="text-lg font-semibold truncate">Aktivity</h1>
          <div className="ml-auto flex gap-2">
            <Button onClick={handleSync} disabled={syncing} size="sm">
              {syncing && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]" />
              )}
              {syncing ? "Synchronizujem…" : "Sync Strava"}
            </Button>

            <Button onClick={resetClientCache} size="sm">
              Reset cache
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-lg mx-auto px-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <WeeklyLoadWidget onOpenDetail={openDetailLoad} />
          <MonoStrainWidget onOpenDetail={openDetailMono} />
          <WidgetPareto8020 onOpenTrend={openDetail8020} weeks={2} />
          <WidgetActivitiesCalendar />
        </div>
      </div>
    </>
  );
}
