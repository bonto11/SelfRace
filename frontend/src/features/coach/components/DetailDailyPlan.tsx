// src/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useMemo } from "react";

import { SURFACE_CARD } from "@/shared/ui/classes";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";

import PlanActive from "@/features/coach/components/PlanActive";

export default function DetailDailyPlan() {
  const { userId } = useUserId();
  const planCtx = usePlanData() as any;

  const rows: any[] = useMemo(
    () => (planCtx?.planRows ?? planCtx?.rows ?? []) as any[],
    [planCtx]
  );

  const hasActivePlan = Array.isArray(rows) && rows.length > 0;
  const isLoading = !!planCtx?.isLoading;
  const loadError: string | null =
    (planCtx?.error as string | null) ?? null;

  if (!userId) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Chýba <code>userId</code> z <code>useUserId</code>. Skontroluj
          prihlásenie používateľa.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 flex items-center gap-2 text-sm">
          <LoadingSpinner size="button" />
          <span>Načítavam tvoj AI daily plán…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm text-red-300">
          Chyba pri načítavaní plánu: {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            AI Daily plan – detail
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xl">
            Tu vidíš aktuálny tréningový plán podľa AI. Správa plánu
            (generovanie, spustenie, zrušenie, predĺženie) prebieha cez
            widget <strong>Coach — Plan</strong> na hlavnom coach
            dashboarde.
          </p>
        </div>
      </section>

      {hasActivePlan ? (
        <section>
          <PlanActive />
        </section>
      ) : (
        <section className={SURFACE_CARD}>
          <div className="px-4 py-4 text-sm">
            Zatiaľ nemáš žiadny aktívny AI daily plán uložený v DB.
            Vygeneruj ho a spusti cez widget{" "}
            <strong>Coach — Plan</strong>, potom sa tu zobrazí detailný
            prehľad jednotlivých tréningov.
          </div>
        </section>
      )}
    </div>
  );
}