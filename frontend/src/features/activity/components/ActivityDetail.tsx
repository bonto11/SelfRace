// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { CARD } from "@/shared/ui/classes";
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
    <div className={`${CARD} space-y-2`}>
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

      {/* HR priebeh – FULL WIDTH v tmavšom bg, bez “karty v karte” */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold">HR priebeh</h4>
          {streams.time_s.length > 10 && (
            <button
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
              onClick={() => setShowFull(true)}
            >
              Zväčšiť
            </button>
          )}
        </div>

        <div className="-mx-3 md:-mx-4 rounded-md bg-gray-800/70 px-3 md:px-4 py-3">
          {/* legenda – v jednom riadku, centrovaná */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-300 mb-2">
            <LegendDot color="#60A5FA" label="Z1" />
            <LegendDot color="#34D399" label="Z2" />
            <LegendDot color="#FBBF24" label="Z3" />
            <LegendDot color="#F97316" label="Z4" />
            <LegendDot color="#EF4444" label="Z5" />
          </div>

          {streams.time_s.length ? (
            <div className="w-full" style={{ height: 160 }}>
              <HrChart xs={streams.time_s} ys={streams.hr} height={160} stroke={1.8} />
            </div>
          ) : (
            <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
          )}
        </div>
      </div>

      {/* FULLSCREEN overlay – bez vnorenej karty, väčšia plocha */}
      {showFull && (
        <div className="fixed inset-0 z-50 bg-black/80">
          <div className="absolute inset-0 p-3 md:p-6">
            <div className="w-full h-full rounded-lg bg-gray-800/80 flex flex-col">
              <div className="flex items-center justify-between p-3">
                <h3 className="text-base md:text-lg font-semibold">HR priebeh (detail)</h3>
                <button onClick={() => setShowFull(false)} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
                  Zavrieť
                </button>
              </div>

              {/* legenda hore – v riadku */}
              <div className="px-3 flex items-center justify-center gap-4 text-[12px] text-slate-300">
                <LegendDot color="#60A5FA" label="Z1" />
                <LegendDot color="#34D399" label="Z2" />
                <LegendDot color="#FBBF24" label="Z3" />
                <LegendDot color="#F97316" label="Z4" />
                <LegendDot color="#EF4444" label="Z5" />
              </div>

              <div className="grow px-3 pb-4">
                <div className="w-full h-full">
                  <HrChart xs={streams.time_s} ys={streams.hr} height={520} stroke={2.2} showLegend={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div>Načítavam detail (laps/splits)…</div>}

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
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}