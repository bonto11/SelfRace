// src/shared/components/ActivitySingle.tsx
"use client";

import { useEffect, useState } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";

type Variant = "activity" | "calendar" | "record" | "plan";

type RecordData = {
  id: string | number;
  distanceLabel: string;
  timeStr: string;
  dateIso?: string | null;
  activityId?: number | null;
  activityName?: string | null;
};

type ActivityData = {
  id: string | number;
  name: string;
  dateIso: string;
  sport: "run" | "ride" | "strength" | "mixed" | "other" | string;
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activityId: number;
  singleDayContext?: boolean;
};

type PlanData = {
  id: string;
  dateLabel?: string | null;
  title: string;
  focus?: string | null;
  durationMin?: number | null;
  intensity?: string | null;
  target?: string | null;
  structure?: any;
};

type DataByVariant<V extends Variant> =
  V extends "record"   ? RecordData   :
  V extends "plan"     ? PlanData     :
  V extends "calendar" ? ActivityData :
  ActivityData;

type Props<V extends Variant = Variant> = {
  variant: V;
  data: DataByVariant<V>;
  defaultOpen?: boolean;
};

const prettySkDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wk  = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
};

const badge = (k: string) =>
  k === "run" ? "Run" :
  k === "ride" ? "Ride" :
  k === "strength" ? "Strength" :
  k === "mixed" ? "Mixed" : "Other";

/* KPI tile */
function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/20 px-4 py-3">
      <div className="text-[10px] opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{String(value)}</div>
    </div>
  );
}

/* Inline detail s grafom */
function ActivityInlineDetail({ activityId }: { activityId: number }) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId) as any | null;

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number; }>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

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

  const distTxt = fmtDistance(summary?.distance_m ?? null);
  const timeTxt = summary?.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  return (
    <div className="px-5 pb-4">{/* licuje s kartou */}
      {/* HR priebeh */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold">HR priebeh</h4>
        </div>
        {streams.time_s.length ? (
          <div className="mb-1">
            <HrChart xs={streams.time_s} ys={streams.hr} height={180} compact />
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

      {/* drobný strip (voliteľne) */}
      {summary && (
        <div className="mt-3 text-xs opacity-70">
          Distance: {distTxt} · Time: {timeTxt} · Avg HR: {summary.average_heartrate_bpm ?? "—"} · Max HR: {summary.max_heartrate_bpm ?? "—"}
        </div>
      )}
    </div>
  );
}

export default function ActivitySingle<V extends Variant>({
  variant,
  data,
  defaultOpen = false,
}: Props<V>) {
  const [open, setOpen] = useState(defaultOpen);

  let headerLeft: React.ReactNode = "—";
  let sportKind = "other";
  let title: React.ReactNode = "";
  let subtitle: string | null = null;
  let metaLine: string[] = [];
  let canToggle = false;
  let detailNode: React.ReactNode = null;

  if (variant === "record") {
    const d = data as RecordData;
    headerLeft = prettySkDate(d.dateIso) ?? "—";
    title = d.timeStr;
    subtitle = d.activityName || null;
    metaLine = d.distanceLabel ? [d.distanceLabel] : [];
    canToggle = !!d.activityId;
    if (open && d.activityId) detailNode = <ActivityInlineDetail activityId={d.activityId} />;
  }

  if (variant === "activity" || variant === "calendar") {
    const d = data as ActivityData;
    headerLeft =
      d.singleDayContext && variant === "calendar" ? " " : (prettySkDate(d.dateIso) ?? "—");
    sportKind = d.sport || "other";
    title = d.name || "Activity";
    metaLine = [
      d.timeStr ? `Time ${d.timeStr}` : null,
      d.distanceStr ? `Distance ${d.distanceStr}` : null,
      d.avgHr != null ? `Avg HR ${d.avgHr}` : null,
      d.maxHr != null ? `Max HR ${d.maxHr}` : null,
    ].filter(Boolean) as string[];
    canToggle = true;

    if (open) {
      const kpis = [
        { label: "TIME", value: d.timeStr || "—" },
        { label: "DISTANCE", value: d.distanceStr || "—" },
        { label: "AVG HR", value: d.avgHr ?? "—" },
        { label: "MAX HR", value: d.maxHr ?? "—" },
      ];
      detailNode = (
        <div className="px-5 pb-4">
          {/* KPI – veľké a s odsadením */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {kpis.map(k => (
              <KpiTile key={k.label} label={k.label} value={k.value as any} />
            ))}
          </div>

          {/* graf + zvyšok */}
          <ActivityInlineDetail activityId={d.activityId} />
        </div>
      );
    }
  }

  if (variant === "plan") {
    const d = data as PlanData;
    headerLeft = d.dateLabel ?? "—";
    title = d.title;
    subtitle = d.focus || null;
    if (d.durationMin != null) metaLine.push(`${d.durationMin} min`);
    if (d.intensity) metaLine.push(d.intensity);
    if (d.target) metaLine.push(d.target);
    canToggle = !!d.structure;
    if (open && d.structure) {
      detailNode = (
        <div className="px-5 pb-4">
          <pre className="text-xs opacity-80 whitespace-pre-wrap">
            {JSON.stringify(d.structure, null, 2)}
          </pre>
        </div>
      );
    }
  }

  return (
    <section
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "px-5 py-4",
        "overflow-hidden",
      ].join(" ")}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{headerLeft}</div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-700">{badge(sportKind)}</span>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => canToggle && setOpen(v => !v)}
            disabled={!canToggle}
            className={[
              "h-8 w-8 grid place-items-center rounded-full border border-white/10",
              canToggle ? "bg-white/10 hover:bg-white/20 transition-colors" : "opacity-40 cursor-not-allowed",
            ].join(" ")}
            title={open ? "Skryť detail" : "Otvoriť detail"}
          >
            <span className={["text-base leading-none select-none transition-transform", open ? "rotate-180" : "rotate-0"].join(" ")}>▾</span>
          </button>
        </div>
      </div>

      {/* title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">
        {title}
      </div>

      {/* subtitle len keď je zavreté */}
      {!open && (subtitle ? (
        <div className="text-xs opacity-80">{subtitle}</div>
      ) : (
        <div className="text-xs opacity-40">{null}</div>
      ))}

      {/* META RIADOK – teraz LEN v ZABALENOM stave */}
      {!open && metaLine.length > 0 && (
        <div className="text-xs mt-1 opacity-80">{metaLine.join(" · ")}</div>
      )}

      {/* DETAIL – flush k okrajom, vnútro px-5 aby všetko lícovalo */}
      {open && detailNode ? (
        <div className="-mx-5 -mb-4">
          {detailNode}
        </div>
      ) : null}
    </section>
  );
}