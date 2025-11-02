"use client";

import * as React from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import TrendWithBands, { Point } from "@/shared/components/trend/TrendWithBands";
import { getBodyFatBands } from "@/shared/utils/bands";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";

type StaticProfile = { sex: "M" | "F" };
type MetricsRow = { updated_at: string; body_fat_pct: number | null };

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [rows, setRows] = React.useState<MetricsRow[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" }).then((r) => r.json());
        if (s?.success) setStat(s.data);
        const m = await fetch(`${API_URL}/profile/metrics/history/${userId}`, { cache: "no-store" }).then((r) => r.json());
        if (m?.success) setRows(m.data ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className={`${CARD} grid place-items-center`} style={{ minHeight: 260 }}>
        <LoadingSpinner size="trend" />
      </div>
    );
  }

  const points: Point[] = rows.map((r) => ({ date: r.updated_at, value: r.body_fat_pct }));
  if (!points.length) return <div className={`${CARD} p-4`}>Žiadne dáta Body Fat %.</div>;

  const bands = stat ? getBodyFatBands(stat.sex) : [];

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h2 className="text-base md:text-lg font-semibold">Trend Body Fat %</h2>
      </div>
      <div className="p-3">
        <TrendWithBands
          title=""          // nadpis riešime v headeri karty
          points={points}
          bands={bands}
          unit="%"
          lineColor="orange"
          ySuggestedMin={0}
          ySuggestedMax={35}
        />
      </div>
    </div>
  );
}