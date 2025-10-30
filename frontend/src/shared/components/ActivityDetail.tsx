// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";
import HrChart from "@/features/activity/components/HrChart";
import { API_URL } from "@/shared/config";

interface Props { activityId: number; }
type StreamsData = { time_s: number[]; hr: (number | null)[]; duration_s: number; };

// --- malý BE fetch helper
async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  // cache z provideru (90d)
  const cachedSummary = getSummary(activityId);

  // lokálne stavy + fallbacky
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any | null>(cachedSummary ?? null);
  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showFull, setShowFull] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // načítanie (cache -> fallback One)
  useEffect(() => {
    let alive = true;
    setErr(null);

    (async () => {
      try {
        setLoading(true);

        // SUMMARY
        let s = getSummary(activityId) ?? null;
        if (!s) {
          const js = await fetchJSON<any>(`${API_URL}/activities/summaryOne/${activityId}`);
          s = js?.summary ?? js ?? null;
        }

        if (!alive) return;
        setSummary(s);

        // STREAMS
        let st = await getStreams(activityId).catch(() => null as any);
        if (!st || !Array.isArray(st.time_s)) {
          const js = await fetchJSON<any>(`${API_URL}/activities/streamsOne/${activityId}`);
          st = {
            time_s: js?.time_s ?? [],
            hr: js?.hr ?? [],
            duration_s: js?.duration_s ?? (Array.isArray(js?.time_s) ? (js.time_s.at(-1) ?? 0) : 0),
          };
        }
        if (!alive) return;
        setStreams(st);

        // DETAIL (laps, splits)
        let extra = await getDetail(activityId).catch(() => ({}));
        if (!extra || (!extra.laps && !extra.splits)) {
          const js = await fetchJSON<any>(`${API_URL}/activities/detailOne/${activityId}`);
          extra = { laps: js?.laps ?? [], splits: js?.splits ?? [] };
        }
        if (!alive) return;
        setLaps(extra.laps || []);
        setSplits(extra.splits || []);

        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
        setLoading(false);
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  // render guards
  const distTxt = useMemo(
    () => fmtDistance(summary?.distance_m ?? null),
    [summary?.distance_m]
  );
  const timeTxt = useMemo(
    () => (summary?.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—"),
    [summary?.moving_time_s]
  );

  if (loading && !summary) {
    return <div className="opacity-80 text-sm">Načítavam aktivitu…</div>;
  }
  if (!summary) {
    return (
      <div className="text-sm">
        ❌ Aktivita sa nenašla. {err ? <span className="opacity-70">({err})</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">{summary.name ?? "Activity"}</h3>

      <p>
        <strong>Date:</strong>{" "}
        {summary.date
          ? new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </p>

      <p><strong>Distance:</strong> {distTxt}</p>
      <p><strong>Time:</strong> {timeTxt}</p>
      <p><strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}</p>
      <p><strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}</p>

      {/* HR priebeh */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-1">
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

        {streams.time_s.length ? (
          <div className="-mx-3 -mt-1 mb-2">
            <HrChart
              xs={streams.time_s}
              ys={streams.hr}
              height={148}
              compact
            />
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
            {splits.map((sp: any, idx: number) => (
              <li key={sp.split_index ?? idx}>
                Split {sp.split_index ?? idx}: {fmtDistance(sp.distance_m)}, {fmtSecondsHMS(sp.moving_time_s)}
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
}: { xs: number[]; ys: (number | null)[]; onClose: () => void; }) {
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
          <div className="px-3 pb-4 grow overflow-auto">
            <div className="w-full" style={{ height: isMobile ? "60vh" : 480 }}>
              <HrChart xs={xs} ys={ys} height={isMobile ? (undefined as any) : 480} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}