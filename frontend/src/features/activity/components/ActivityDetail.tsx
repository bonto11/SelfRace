// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/shared/config";
import { CARD } from "@/shared/ui/classes";
import { toEffSport, sportUiLabel } from "@/features/activity/utils/sport";

interface Props {
  activityId: number;
}

interface ActivityDetailData {
  id: number;
  name: string;
  sport_type?: string | null;      // pôvodný string zo Stravy
  sport_type_fe?: string | null;   // náš auto FE canonical
  sport_type_ovrd?: string | null; // manuálny override
  distance_m: number;
  moving_time_s: number;
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
      const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success) setData(json.data ?? json.summary ?? null);
      else setData(null);
      setLoading(false);
    })();
  }, [activityId]);

  if (loading) return <div>Načítavam detail...</div>;
  if (!data) return <div>❌ Nepodarilo sa načítať detail.</div>;

  const eff = toEffSport(data);
  const dist = Number(data.distance_m ?? 0);
  const move = Number(data.moving_time_s ?? 0);

  return (
    <div className={`${CARD} space-y-4`}>
      <h3 className="text-lg font-bold">{data.name}</h3>

      <p>
        <strong>Sport:</strong> {sportUiLabel(eff)}
      </p>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(data.date).toLocaleString("sk-SK", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <p>
        <strong>Distance:</strong> {(dist / 1000).toFixed(2)} km
      </p>

      <p>
        <strong>Time:</strong> {Math.floor(move / 60)} min
      </p>

      <p>
        <strong>Avg HR:</strong> {data.average_heartrate_bpm ?? "—"}
      </p>

      <p>
        <strong>Max HR:</strong> {data.max_heartrate_bpm ?? "—"}
      </p>

      <p>
        <strong>Elevation gain:</strong> {data.total_elevation_gain_m ?? "—"} m
      </p>
    </div>
  );
}