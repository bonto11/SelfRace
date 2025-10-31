"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import TrendWithBands, {
  Point,
} from "@/shared/components/trend/TrendWithBands";
import { getBodyFatBands } from "@/shared/utils/bands";

type StaticProfile = { sex: "M" | "F" };
type MetricsRow = { updated_at: string; body_fat_pct: number | null };

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [stat, setStat] = useState<StaticProfile | null>(null);
  const [rows, setRows] = useState<MetricsRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const s = await fetch(`${API_URL}/profile/static/${userId}`).then((r) =>
        r.json()
      );
      if (s.success) setStat(s.data);

      const m = await fetch(
        `${API_URL}/profile/metrics/history/${userId}`
      ).then((r) => r.json());
      if (m.success) setRows(m.data);
    })();
  }, [userId]);

  const points: Point[] = useMemo(
    () => rows.map((r) => ({ date: r.updated_at, value: r.body_fat_pct })),
    [rows]
  );

  const bands = useMemo(() => (stat ? getBodyFatBands(stat.sex) : []), [stat]);

  if (!points.length) return <div>Načítavam Body Fat %…</div>;

  return (
    <TrendWithBands
      title="Trend Body Fat %"
      points={points}
      bands={bands}
      unit="%"
      lineColor="orange"
      ySuggestedMin={0}
      ySuggestedMax={35}
    />
  );
}
