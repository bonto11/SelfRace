"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { toast } from "@/shared/components/ui/Toast";
import WeeklyLoadWidget from "@/shared/components/widgets/WidgetWeeklyLoad";
import MonoStrainWidget from "@/shared/components/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/shared/components/widgets/WidgetPareto8020";
import WidgetActivitiesCalendar from "@/shared/components/widgets/WidgetActivitiesCalendar";
import Button from "@/shared/components/ui/Button";
import { resetClientCache } from "@/shared/utils/resetClientCache";

export default function ActivitiesPage() {
  const { userId } = useUserId();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!userId || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/activities/sync/${userId}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        const imp = Number.isFinite(json.imported) ? json.imported : 0;
        const upd = Number.isFinite(json.updated) ? json.updated : 0;
        const skp = Number.isFinite(json.skipped) ? json.skipped : 0;
        toast.success(
          `✅ Sync OK • imported: ${imp} • updated: ${upd} • skipped: ${skp}`
        );
      } else {
        toast.error(`❌ Sync error: ${json?.detail || "unknown"}`);
      }
    } catch (e: any) {
      toast.error(`❌ Sync request failed: ${e?.message || e}`);
    } finally {
      setSyncing(false);
    }
  }

  const openDetailLoad = () => router.push("/activities/load");
  const openDetailMono = () => router.push("/activities/mono");
  const openDetail8020 = () => router.push("/activities/pareto");

  return (
    <>
      {/* Sticky header – rovnaký ako inde */}
      <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="max-w-screen-lg mx-auto flex items-center gap-3">
          <h1 className="text-lg font-semibold truncate">Aktivity</h1>
          <div className="ml-auto">
            <Button onClick={handleSync} disabled={syncing} size="sm">
              {syncing && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]" />
              )}
              {syncing ? "Synchronizujem…" : "Sync Strava"}
            </Button>

            <Button onClick={resetClientCache} size="sm"></Button>
          </div>
        </div>
      </div>

      {/* widgety – 1 stĺpec → 2 stĺpce na md+ */}
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
