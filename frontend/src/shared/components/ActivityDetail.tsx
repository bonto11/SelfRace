"use client";

import { useEffect, useMemo, useState } from "react";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";
import HrChart from "@/shared/components/trend/HrChart";
import { API_URL } from "@/shared/config";

type Props = {
  activityId: number;
  /** vložené v karte – bez duplicitných nadpisov; zobrazíme vlastný „big facts“ rad */
  inline?: boolean;
  /** kompaktnejšie: menší graf, bez tlačidla Zväčšiť */
  compact?: boolean;
  /** horný <h3> názov (ignoruje sa pri inline=true) */
  showHeader?: boolean;
};

type StreamsData = {
  time_s: number[];
  hr: (number | null)[];
  duration_s: number;
};

export default function ActivityDetail({
  activityId,
  inline = false,
  compact = false,
  showHeader = true,
}: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId) as any | null;

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await getStreams(activityId);
        const extra = await getDetail(activityId);
        if (!alive) return;
        if (s) setStreams(s as any);
        if (extra) {
          setLaps((extra as any).laps || []);
          setSplits((extra as any).splits || []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activityId, getStreams, getDetail]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt = summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  const dateText = useMemo(() => {
    try {
      return new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return summary.date; }
  }, [summary.date]);

  // Render flagy
  const showTopHeader = showHeader && !inline;
  const showKeyFactsBlock = !inline && !compact;     // klasické odrážky len v plnom móde
  const showEnlargeBtn = !compact && !!streams.time_s.length;

  return (
    <div className={inline || compact ? "space-y-3 pt-1" : "space-y-4"}>
      {/* Header – iba mimo inline */}
      {showTopHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{summary.name}</h3>
        </div>
      )}

      {/* BIG FACTS – len v inline (veľšie hodnoty, bez duplicitných textov) */}
      {inline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FactBox label="Time" value={timeTxt} />
          <FactBox label="Distance" value={distTxt} />
          <FactBox label="Avg HR" value={summary.average_heartrate_bpm ?? "—"} />
          <FactBox label="Max HR" value={summary.max_heartrate_bpm ?? "—"} />
        </div>
      )}

      {/* Klasické fakty – len mimo inline/compact */}
      {showKeyFactsBlock && (
        <div className="space-y-1">
          <p><strong>Date:</strong> {dateText}</p>
          <p><strong>Distance:</strong> {distTxt}</p>
          <p><strong>Time:</strong> {timeTxt}</p>
          <p><strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}</p>
          <p><strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}</p>
        </div>
      )}

      {/* HR priebeh */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-bold">HR priebeh</h4>
          {showEnlargeBtn && (
            <button
              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
              onClick={() => setShowFull(true)}
            >
              Zväčšiť
            </button>
          )}
        </div>
        {streams.time_s.length ? (
          <div className="mb-2">
            <HrChart
              xs={streams.time_s}
              ys={streams.hr}
              height={compact ? 120 : 148}
              compact
            />
          </div>
        ) : (
          <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
        )}
      </div>

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

/* --- pomocné komponenty --- */
function FactBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold leading-tight">{String(value)}</div>
    </div>
  );
}

/* --------------- Fullscreen overlay komponent --------------- */
function FullHrOverlay({
  xs, ys, onClose,
}: { xs: number[]; ys: (number | null)[]; onClose: () => void }) {
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