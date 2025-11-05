"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";

/** Varianty použitia – minimalizujeme props */
type Variant = "activity" | "calendar" | "record" | "plan";

/** ====== Typy dát pre varianty ====== */
type RecordData = {
  id: string | number;
  distanceLabel: string;         // "5 km"
  timeStr: string;               // "00:18:45"
  dateIso?: string | null;
  activityId?: number | null;    // ak existuje, dá sa rozbaliť detail
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
  singleDayContext?: boolean;    // pod kalendárom 1 deň => skryť minihlavicku
};

type PlanData = {
  id: string;
  dateLabel?: string | null;     // "Mon · 2025-11-03"
  title: string;
  focus?: string | null;
  durationMin?: number | null;
  intensity?: string | null;
  target?: string | null;
  structure?: any;               // surový objekt (vyrenderujeme jednoduché JSON, alebo sem doplníš vlastný rendering)
};

type DataByVariant<V extends Variant> =
  V extends "record"   ? RecordData   :
  V extends "plan"     ? PlanData     :
  V extends "calendar" ? ActivityData :
  /* "activity" */       ActivityData;

type Props<V extends Variant = Variant> = {
  variant: V;
  data: DataByVariant<V>;
  /** default false – ak true, karta pri mount-e už otvorená */
  defaultOpen?: boolean;
};

/** ====== Pomocné ====== */
const prettySkDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
};

const badge = (kind: string) =>
  kind === "run" ? "Run" :
  kind === "ride" ? "Ride" :
  kind === "strength" ? "Strength" :
  kind === "mixed" ? "Mixed" : "Other";

/** ====== Vnútorný “detail” blok pre aktivity ====== */
function ActivityInlineDetail({
  activityId,
  compact = true,
}: { activityId: number; compact?: boolean }) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId) as any | null;

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number; }>({
    time_s: [], hr: [], duration_s: 0
  });
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

  if (!summary) return <div className="text-sm opacity-80">❌ Aktivita sa nenašla v 90-d cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt = summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  return (
    <div className="px-2 pb-2">
      {/* KPI – v detaile pod kartou typicky nechceme duplikovať to, čo je v meta rade; necháme iba graf a splits/laps */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold">HR priebeh</h4>
        </div>
        {streams.time_s.length ? (
          <div className="mb-1">
            <HrChart xs={streams.time_s} ys={streams.hr} height={compact ? 148 : 220} compact={compact} />
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

      {/* drobný info strip, ak chceš */}
      <div className="mt-3 text-xs opacity-70">
        Distance: {distTxt} · Time: {timeTxt} · Avg HR: {summary.average_heartrate_bpm ?? "—"} · Max HR: {summary.max_heartrate_bpm ?? "—"}
      </div>
    </div>
  );
}

/** ====== Hlavná karta (obsah + rozbalenie) ====== */
export default function ActivitySingle<V extends Variant>({
  variant,
  data,
  defaultOpen = false,
}: Props<V>) {
  const [open, setOpen] = useState(defaultOpen);

  // hranové nastavenia (flush detail = licovanie s kartou)
  const flushDetail = variant !== "record";  // record obvykle bez inline detailu (ale vieš zapnúť nižšie ak activityId existuje)

  // hlavička vľavo + titulok + meta podľa variantu
  let headerLeft: string | React.ReactNode = "—";
  let sportKind: string = "other";
  let title: React.ReactNode = "";
  let subtitle: string | null = null;
  let meta: string[] = [];
  let canToggle = false;  // povolenie rozbalenia
  let detailNode: React.ReactNode = null;

  if (variant === "record") {
    const d = data as RecordData;
    headerLeft = prettySkDate(d.dateIso) ?? "—";
    sportKind = "other";
    title = d.timeStr;
    subtitle = d.activityName || null;
    meta = d.distanceLabel ? [d.distanceLabel] : [];
    canToggle = !!d.activityId;
    if (open && d.activityId) {
      detailNode = <ActivityInlineDetail activityId={d.activityId} compact />;
    }
  }

  if (variant === "activity" || variant === "calendar") {
    const d = data as ActivityData;
    headerLeft =
      d.singleDayContext && variant === "calendar" ? " " : (prettySkDate(d.dateIso) ?? "—");
    sportKind = d.sport || "other";
    title = d.name || "Activity";
    subtitle = null;
    meta = [
      d.timeStr ? `Time ${d.timeStr}` : null,
      d.distanceStr ? `Distance ${d.distanceStr}` : null,
      d.avgHr != null ? `Avg HR ${d.avgHr}` : null,
      d.maxHr != null ? `Max HR ${d.maxHr}` : null,
    ].filter(Boolean) as string[];
    canToggle = true;
    if (open) {
      detailNode = <ActivityInlineDetail activityId={d.activityId} compact />;
    }
  }

  if (variant === "plan") {
    const d = data as PlanData;
    headerLeft = d.dateLabel ?? "—";
    sportKind = "other";
    title = d.title;
    subtitle = d.focus || null;
    meta = [];
    if (d.durationMin != null) meta.push(`${d.durationMin} min`);
    if (d.intensity) meta.push(d.intensity);
    if (d.target) meta.push(d.target);
    canToggle = !!d.structure;
    if (open && d.structure) {
      // sem si neskôr dosadíš svoj render (PlanCardDetail). Dočasne textové JSON.
      detailNode = (
        <div className="px-2 pb-2">
          <pre className="text-xs opacity-80 whitespace-pre-wrap">
            {JSON.stringify(d.structure, null, 2)}
          </pre>
        </div>
      );
    }
  }

  // karta
  return (
    <section
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "px-5 py-4",
        "overflow-hidden",                 // dôležité kvôli flush detailu
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{headerLeft}</div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-700">{badge(sportKind)}</span>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => canToggle && setOpen(v => !v)}
            disabled={!canToggle}
            title={open ? "Skryť detail" : "Otvoriť detail"}
            className={[
              "h-8 w-8 grid place-items-center rounded-full border border-white/10",
              canToggle ? "bg-white/10 hover:bg-white/20 transition-colors" : "opacity-40 cursor-not-allowed",
            ].join(" ")}
          >
            <span className={["text-base leading-none select-none transition-transform", open ? "rotate-180" : "rotate-0"].join(" ")}>▾</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">
        {title}
      </div>

      {/* Subtitle (skrývame pri open, nech je čistejšie) */}
      {!open && (subtitle ? (
        <div className="text-xs opacity-80">{subtitle}</div>
      ) : (
        <div className="text-xs opacity-40">{null}</div>
      ))}

      {/* Meta – ostáva viditeľná AJ pri open */}
      {!!meta.length && (
        <div className="text-xs mt-1 opacity-80">{meta.join(" · ")}</div>
      )}

      {/* Detail – flush k okrajom: žiadny ďalší “panel” vnútri */}
      {open && detailNode ? (
        flushDetail ? (
          <div className="-mx-5 -mb-4">
            {detailNode}
          </div>
        ) : (
          <div className="mt-4">{detailNode}</div>
        )
      ) : null}
    </section>
  );
}