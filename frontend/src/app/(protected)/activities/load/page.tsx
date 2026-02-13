// src/app/(protected)/activities/load/page.tsx
"use client";

import { useCallback, useState } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import TrendWeeklyLoad from "@/app/features/activities/components/TrendWeeklyLoad";
import ActivityTable from "@/app/features/activities/components/ActivityTable";
import { useT } from "@/app/shared/i18n/useT";

import type {
  WeekPick,
  Range,
} from "@/app/features/activities/types/activities";

export default function Page() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");
  const t = useT();

  const handlePick = useCallback((w: WeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <PageShell title={t("weeklyLoad.title")} showBack showPoweredByStrava>
      <TrendWeeklyLoad
        onPickWeek={handlePick}
        onSportChange={(s) => setSport(s)}
      />
      <ActivityTable start={range.start} end={range.end} sport={sport} />
    </PageShell>
  );
}
