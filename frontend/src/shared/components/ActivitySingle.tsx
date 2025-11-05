"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import { ComponentVariant } from "@/features/activity/utils/activity";

/* ====== Typy ====== */
type DataIn = {
  id: string | number;
  name: string;
  dateIso?: string | null;
  sport: "run" | "ride" | "strength" | "mixed" | "other" | string;
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activityId?: number | null;           // pre načítanie streamov/detailu
  singleDayContext?: boolean;           // ak je tabuľka jedného dňa → môžeme skryť headerLeft
};

export type ActivitySingleProps = {
  variant?: ComponentVariant;           // "activity" | "calendar" | "pb"
  data: DataIn;
  defaultOpen?: boolean;
};

/* ====== Presety podľa variantu ====== */
const PRESET: Record<ComponentVariant, {
  outerPadding: string;
  detailFlush: boolean;
  compactChart: boolean;
  showSmallMetaWhenClosed: boolean;
  hideSmallMetaWhenOpen: boolean;
  showBigMetaWhenOpen: boolean;
  headerLeftVisible: boolean;
}> = {
  activity: {
    outerPadding: "px-5 py-4",
    detailFlush: true,
    compactChart: false,
    showSmallMetaWhenClosed: true,
    hideSmallMetaWhenOpen: true,
    showBigMetaWhenOpen: true,
    headerLeftVisible: true,
  },
  calendar: {
    outerPadding: "px-5 py-4",
    detailFlush: true,
    compactChart: true,
    showSmallMetaWhenClosed: true,
    hideSmallMetaWhenOpen: true,
    showBigMetaWhenOpen: true,
    headerLeftVisible: false, // duplicitné s titulkom v tabuľke
  },
  pb: {
    outerPadding: "px-5 py-4",
    detailFlush: true,
    compactChart: true,
    showSmallMetaWhenClosed: true,
    hideSmallMetaWhenOpen: true,
    showBigMetaWhenOpen: true,
    headerLeftVisible: false, // v PB nechceme vľavo dátum
  },
};

/* ====== Pomocníci ====== */
function prettySkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wk  = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function SportBadge({ kind }: { kind: string }) {
  const label =
    kind === "run" ? "Run" :
    kind === "ride" ? "Ride" :
    kind === "strength" ? "Strength" :
    kind === "mixed" ? "Mixed" : "Other";
  return <span className="text-xs px-2 py-0.5 rounded bg-gray-700">{label}</span>;
}

/* ====== Hlavný komponent ====== */
export default function ActivitySingle({ variant = "activity", data, defaultOpen = false }: ActivitySingleProps) {
  const cfg = PRESET[variant];
  const [opened, setOpened] = useState<boolean>(defaultOpen);
  const isPB = variant === "pb";

  const headerLeft =
    (!cfg.headerLeftVisible || data.singleDayContext) ? " " : prettySkDate(data.dateIso ?? null);

  // Malá (collapsed) meta – pre PB zámerne NEzobrazujeme "Time …", aby sa neduplikovalo s veľkým časom
  const collapsedMetaItems = isPB
    ? [
        data.distanceStr ? `Distance ${data.distanceStr}` : null,
        data.avgHr != null ? `Avg HR ${data.avgHr}` : null,
        data.maxHr != null ? `Max HR ${data.maxHr}` : null,
      ]
    : [
        data.timeStr ? `Time ${data.timeStr}` : null,
        data.distanceStr ? `Distance ${data.distanceStr}` : null,
        data.avgHr != null ? `Avg HR ${data.avgHr}` : null,
        data.maxHr != null ? `Max HR ${data.maxHr}` : null,
      ];
  const collapsedMeta = (collapsedMetaItems.filter(Boolean) as string[]);

  return (
    <section
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "overflow-hidden",
        cfg.outerPadding,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{headerLeft}</div>
        <div className="flex items-center gap-2">
          <SportBadge kind={data.sport} />
          <button
            type="button"
            aria-expanded={opened}
            onClick={() => setOpened(s => !s)}
            title={opened ? "Skryť detail" : "Otvoriť detail"}
            className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span className={["text-base leading-none select-none transition-transform", opened ? "rotate-180" : ""].join(" ")}>▾</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">{data.name}</div>

      {/* PB: veľký čas priamo z DB (best_time_s/time_str) */}
      {isPB && (
        <div className="mt-1 text-2xl font-extrabold tabular-nums leading-none">
          {data.timeStr ?? "—"}
        </div>
      )}

      {/* Malá meta len v zavretom stave */}
      {cfg.showSmallMetaWhenClosed && !opened && collapsedMeta.length > 0 && (
        <div className="text-xs mt-1 opacity-80">{collapsedMeta.join(" · ")}</div>
      )}

      {/* Detail (flush podľa presetov) */}
      {opened && (
        cfg.detailFlush ? (
          <div className="-mx-5 -mb-4 mt-3">
            <div className="px-4 pb-4">
              <DetailBody data={data} cfg={cfg} />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <DetailBody data={data} cfg={cfg} />
          </div>
        )
      )}
    </section>
  );
}

/* ====== Telo detailu (KPI + graf + splits/laps) ====== */
function DetailBody({
  data,
  cfg,
}: {
  data: DataIn;
  cfg: (typeof PRESET)[keyof typeof PRESET];
}) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const s = data.activityId != null ? (getSummary(data.activityId) as any | null) : null;

  // KPI (veľké) – TIME uprednostní summary; fallback je PB čas z DB (data.timeStr)
  const distTxt = s ? fmtDistance(s.distance_m ?? null) : (data.distanceStr ?? "—");
  const timeTxt = s && s.moving_time_s != null ? fmtSecondsHMS(s.moving_time_s) : (data.timeStr ?? "—");
  const avgTxt  = s ? (s.average_heartrate_bpm ?? "—") : (data.avgHr ?? "—");
  const maxTxt  = s ? (s.max_heartrate_bpm ?? "—") : (data.maxHr ?? "—");

  const [streams, setStreams] = useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number; }>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    if (data.activityId == null) return;
    (async () => {
      try {
        const st = await getStreams(data.activityId!);
        const dt = await getDetail(data.activityId!);
        if (!alive) return;
        if (st) setStreams(st as any);
        if (dt) {
          setLaps((dt as any).laps || []);
          setSplits((dt as any).splits || []);
        }
      } finally {
        // no-op
      }
    })();
    return () => { alive = false; };
  }, [data.activityId, getStreams, getDetail]);

  return (
    <div>
      {cfg.showBigMetaWhenOpen && (
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { label: "TIME", value: timeTxt },
            { label: "DISTANCE", value: distTxt },
            { label: "AVG HR", value: avgTxt },
            { label: "MAX HR", value: maxTxt },
          ].map(t => (
            <div key={t.label} className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/20 px-3 py-2">
              <div className="text-[10px] opacity-70">{t.label}</div>
              <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* HR priebeh */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold">HR priebeh</h4>
        </div>
        {streams.time_s.length ? (
          <div className="mb-1">
            <HrChart
              xs={streams.time_s}
              ys={streams.hr}
              height={cfg.compactChart ? 148 : 220}
              compact={cfg.compactChart}
            />
          </div>
        ) : (
          <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
        )}
      </div>

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
    </div>
  );
}