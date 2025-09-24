"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/shared/config";

interface Props {
  activityId: number;
}

interface ActivityDetailData {
  id: number;
  name: string;
  sport_type: string;
  distance_m: number;
  moving_time_s: number;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  total_elevation_gain_m: number | null;
  date: string;
  // doplníme ďalšie polia podľa BE
}

export default function ActivityDetail({ activityId }: Props) {
  const [data, setData] = useState<ActivityDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      setLoading(false);
    }
    if (activityId) load();
  }, [activityId]);

  if (loading) return <div>Načítavam detail...</div>;
  if (!data) return <div>❌ Nepodarilo sa načítať detail.</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-2">
      <h3 className="text-lg font-bold">{data.name}</h3>
      <p>
        <strong>Sport:</strong> {data.sport_type}
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
        <strong>Distance:</strong> {(data.distance_m / 1000).toFixed(2)} km
      </p>
      <p>
        <strong>Time:</strong> {Math.floor(data.moving_time_s / 60)} min
      </p>
      <p>
        <strong>Avg HR:</strong> {data.average_heartrate_bpm ?? "-"}
      </p>
      <p>
        <strong>Max HR:</strong> {data.max_heartrate_bpm ?? "-"}
      </p>
      <p>
        <strong>Elevation gain:</strong> {data.total_elevation_gain_m ?? "-"} m
      </p>
    </div>
  );
}
