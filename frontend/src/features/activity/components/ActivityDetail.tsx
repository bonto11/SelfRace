// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";
import HrChart from "@/features/activity/components/HrChart";

interface Props { activityId: number; }
type StreamsData = { time_s: number[]; hr: (number | null)[]; duration_s: number };

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId);

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const s = await getStreams(activityId);
      const extra = await getDetail(activityId);
      if (!alive) return;
      setStreams(s);
      setLaps(extra.laps || []);
      setSplits(extra.splits || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [activityId, getStreams, getDetail]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt = summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">{summary.name}</h3>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </p>

      <p><strong>Distance:</strong> {distTxt}</p>
      <p><strong>Time:</strong> {timeTxt}</p>
      <p><strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}</p>
      <p><strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}</p>

      {/* HR priebeh */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold">HR priebeh</h4>
          {!!streams.time_s.length && (
            <button
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
              onClick={() => setShowFull(true)}
            >
              Zväčšiť
            </button>
          )}
        </div>

        {/* tesnejšie k okrajom kontajnera, vyšší mini-graf */}
        {streams.time_s.length ? (
          <div className="mt-1 -mx-1">
            <HrChart xs={streams.time_s} ys={streams.hr} height={160} compact />
          </div>
        ) : (
          <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
        )}
      </div>

      {/* LAPS */}
      {!!laps.length && (
        <>
          <h4 className="font-bold mt-3">Laps</h4>
          <ul className="list-disc pl-5">
            {laps.map((lap: any, idx: number) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)}, {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* SPLITS */}
      {!!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((split: any, idx: number) => (
              <li key={split.split_index ?? idx}>
                Split {split.split_index ?? idx}: {fmtDistance(split.distance_m)}, {fmtSecondsHMS(split.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Fullscreen overlay – scroll lock na pozadí, scroll vnútri */}
      {showFull && (
        <FullHrOverlay
          xs={streams.time_s}
          ys={streams.hr}
          onClose={() => setShowFull(false)}
        />
      )}
    </div>
  );
}

/* --------------- Fullscreen overlay komponent --------------- */
function FullHrOverlay({
  xs, ys, onClose,
}: { xs: number[]; ys: (number|null)[]; onClose: () => void }) {
  // zamknúť scroll body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-hidden">
      <div className="absolute inset-0 p-3 md:p-6">
        <div className="bg-gray-800 rounded-lg w-full h-full shadow-lg flex flex-col">
          <div className="flex items-center justify-between p-3">
            <h3 className="text-base md:text-lg font-semibold">HR priebeh (detail)</h3>
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
              Zavrieť
            </button>
          </div>
          {/* scroll len tu vo vnútri */}
          <div className="px-3 pb-4 grow overflow-auto">
            <div className="w-full" style={{ height: isMobile ? "60vh" : 480 }}>
              <HrChart xs={xs} ys={ys} height={isMobile ? undefined as any : 480} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}