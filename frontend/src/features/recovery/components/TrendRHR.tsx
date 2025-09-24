"use client";

import { useEffect, useState, useMemo } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import TrendWithBands, {
  Band,
  Point,
} from "@/shared/components/TrendWithBands";
import rhrRef from "@/data/RHR_Ref_VerywellFit.json";

type RecoveryRow = {
  date: string;
  RHR_bpm: number | null;
  // ...môže tu byť aj HRV/Sleep atď., nevadí
};

type StaticProfile = {
  sex: "M" | "F";
  birth_date: string; // ISO
};

export default function TrendRHR_Recovery() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [stat, setStat] = useState<StaticProfile | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      // Recovery história
      const recRes = await fetch(`${API_URL}/recovery/${userId}`);
      const recJson = await recRes.json();
      if (recJson.success) setRows(recJson.data);

      // Statický profil pre vek/pohlavie
      const statRes = await fetch(`${API_URL}/profile/static/${userId}`);
      const statJson = await statRes.json();
      if (statJson.success) setStat(statJson.data);
    }
    load();
  }, [userId]);

  const points: Point[] = useMemo(
    () => rows.map((r) => ({ date: r.date, value: r.RHR_bpm })),
    [rows]
  );

  // vyber pásma podľa veku/pohlavia
  const bands: Band[] = useMemo(() => {
    if (!stat) return [];
    const age = Math.floor(
      (Date.now() - new Date(stat.birth_date).getTime()) /
        (365.25 * 24 * 3600 * 1000)
    );
    const group = (rhrRef as any[]).find(
      (g) => g.sex === stat.sex && age >= g.age_min && age <= g.age_max
    );
    return (group?.ranges ?? []) as Band[];
  }, [stat]);

  if (!points.length) return <div>Načítavam RHR…</div>;

  return (
    <TrendWithBands
      title="Trend Resting HR"
      points={points}
      bands={bands}
      unit="bpm"
      lineColor="orange"
      ySuggestedMin={40}
      ySuggestedMax={100}
    />
  );
}
