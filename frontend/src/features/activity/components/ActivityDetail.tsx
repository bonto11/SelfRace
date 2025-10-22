// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";

interface Props {
  activityId: number;
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getDetail } = useActivityData();
  const [loading, setLoading] = useState(true);
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  const summary = getSummary(activityId);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const extra = await getDetail(activityId);
      if (!alive) return;
      setLaps(extra.laps || []);
      setSplits(extra.splits || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activityId, getDetail]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  return (
    <div className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-bold">{summary.name}</h3>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <p>
        <strong>Distance:</strong> {fmtDistance(summary.distance_m)}
      </p>
      <p>
        <strong>Time:</strong> {fmtSecondsHMS(summary.moving_time_s)}
      </p>
      <p>
        <strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}
      </p>
      <p>
        <strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}
      </p>

      {loading && <div>Načítavam detail (laps/splits)…</div>}

      {!loading && !!laps.length && (
        <>
          <h4 className="font-bold mt-3">Laps</h4>
          <ul className="list-disc pl-5">
            {laps.map((lap, idx) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)},{" "}
                {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && !!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((split, idx) => (
              <li key={split.split_index ?? idx}>
                Split {split.split_index ?? idx}: {fmtDistance(split.distance_m)},{" "}
                {fmtSecondsHMS(split.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}