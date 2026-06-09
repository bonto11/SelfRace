"use client";

import { useState, useCallback } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import TrendPareto8020 from "@/app/features/activities/components/TrendPareto8020";
import ActivityTable from "@/app/features/activities/components/ActivityTable";

import type { Range } from "@/app/features/activities/types/activities";
import type { ParetoWeekPick } from "@/app/features/activities/types/pareto";
import { useT } from "@/app/shared/i18n/useT";

export default function ParetoPage() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");
  const t = useT();

  const handlePick = useCallback((w: ParetoWeekPick | null) => {
    if (!w) { setRange({}); return; }
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <PageShell title={t("pareto8020.title")} showBack showPoweredByStrava>
      <TrendPareto8020 onPickWeek={handlePick} />
      <ActivityTable start={range.start} end={range.end} sport={sport} />
    </PageShell>
  );
}
