// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/shared/config";
import { CARD } from "@/shared/ui/classes";
import { toEffSport, sportUiLabel } from "@/features/activity/utils/sport";
import { THEME } from "@/shared/theme/tokens";

interface Props {
  activityId: number;
}

interface ActivityDetailData {
  id: number;
  name: string;
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  total_elevation_gain_m: number | null;
  date: string; // ISO
}

export default function ActivityDetail({ activityId }: Props) {
  const [data, setData] = useState<ActivityDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activityId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/activities/detail/${activityId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        // API môže vracať {success, data} alebo {success, summary}
        const payload = json?.data ?? json?.summary ?? null;
        setData(payload);
      } catch (e) {
        console.error("[ACT][detail] fetch error:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [activityId]);

  if (loading) return <div>Načítavam detail…</div>;
  if (!data) return <div>❌ Nepodarilo sa načítať detail.</div>;

  const eff = toEffSport(data);
  const distKm = data.distance_m != null ? (data.distance_m / 1000).toFixed(2) : "—";
  const moveMin = data.moving_time_s != null ? Math.floor(data.moving_time_s / 60) : null;

  return (
    <div className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-bold">{data.name}</h3>

      <p><strong>Sport:</strong> {sportUiLabel(eff)}</p>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(data.date).toLocaleString(THEME.i18n.dateLocale, {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      </p>

      <p><strong>Distance:</strong> {distKm} km</p>
      <p><strong>Time:</strong> {moveMin != null ? `${moveMin} min` : "—"}</p>
      <p><strong>Avg HR:</strong> {data.average_heartrate_bpm ?? "—"}</p>
      <p><strong>Max HR:</strong> {data.max_heartrate_bpm ?? "—"}</p>
      <p><strong>Elevation gain:</strong> {data.total_elevation_gain_m ?? "—"} m</p>
    </div>
  );
}