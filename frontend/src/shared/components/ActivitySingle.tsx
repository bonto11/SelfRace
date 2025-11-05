"use client";

import { useEffect, useState } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import { ComponentVariant } from "@/features/activity/utils/activity";

/* ===== Typy vstupu ===== */
type DataIn = {
  id: string | number;
  name: string;
  dateIso?: string | null;
  sport: "run" | "ride" | "strength" | "mixed" | "other" | string;

  // ACTIVITY / PB
  timeStr?: string | null;        // PB čas alebo duration z aktivity
  distanceStr?: string | null;    // napr. "6.08 km" alebo "0.00 km"
  avgHr?: number | null;
  maxHr?: number | null;
  activityId?: number | null;     // pre načítanie streamov/detailu (activity/pb)

  // PLAN (AI coach)
  planDur?: string | null;        // napr. "60 min"
  planIntensity?: string | null;  // napr. "Z3 / tempo"
  planTarget?: string | null;     // napr. "pace 4:40–4:50"
  planNotes?: string | null;      // ľubovoľný text

  singleDayContext?: boolean;
};

export type ActivitySingleProps = {
  variant?: ComponentVariant;     // "activity" | "calendar" | "pb" | "plan"
  data: DataIn;
  defaultOpen?: boolean;

  /** voliteľné akcie – použijú sa iba na DESKTOPE (náhrada za swipe) */
  onEdit?: () => void;
  onDelete?: () => void;
};

/* ===== Presety ===== */
const PRESET: Record<ComponentVariant, {
  outerPadding: string;
  detailFlush: boolean;
  compactChart: boolean;
}> = {
  activity: { outerPadding: "px-5 py-4", detailFlush: true, compactChart: false },
  calendar: { outerPadding: "px-5 py-4", detailFlush: true, compactChart: true },
  pb:       { outerPadding: "px-5 py-4", detailFlush: true, compactChart: true },
  plan:     { outerPadding: "px-5 py-4", detailFlush: true, compactChart: true },
};

/* ===== Helpers ===== */
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

/** vyparsuje km zo stringu typu "6.08 km" (alebo vráti null) */
function parseKm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*km/i);
  if (!m) return null;
  return Number(String(m[1]).replace(",", "."));
}

/** robustná detekcia touch zariadenia */
function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    try {
      const viaMQ = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
      const viaPts = typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 0;
      const viaOn = typeof window !== "undefined" && ("ontouchstart" in window);
      const isTouch = !!(viaMQ || viaPts || viaOn);
      setTouch(isTouch);
    } catch (e) {
      setTouch(false);
    }
  }, []);
  return touch;
}

/* ===== Hlavný komponent ===== */
export default function ActivitySingle({
  variant = "activity",
  data,
  defaultOpen = false,
  onEdit,
  onDelete,
}: ActivitySingleProps) {
  const cfg = PRESET[variant];
  const [opened, setOpened] = useState<boolean>(defaultOpen);
  const isPB   = variant === "pb";
  const isPlan = variant === "plan";
  const isTouch = useIsTouch();
  const showDesktopActions = !isTouch && (!!onEdit || !!onDelete);

  // Header: vľavo dátum – skry v kalendári, inak zobraz
  const headerLeft = variant === "calendar" ? "" : prettySkDate(data.dateIso ?? null);

  // Sekundárna línia pod hlavným textom:
  // - PB: vždy Distance (ak je)
  // - PLAN: poskladaj z planDur / intensity / target
  // - Activity/Calendar: ak distance > 0 → Distance; inak Time
  const distKm = parseKm(data.distanceStr);
  let secondaryLine: string | null = null;

  if (isPB) {
    secondaryLine = data.distanceStr ? `Distance ${data.distanceStr}` : null;
  } else if (isPlan) {
    const bits = [
      data.planDur ?? "",
      data.planIntensity ?? "",
      data.planTarget ?? "",
    ].filter(Boolean);
    secondaryLine = bits.length ? bits.join(" · ") : null;
  } else {
    if (distKm != null && distKm > 0) secondaryLine = `Distance ${data.distanceStr}`;
    else if (data.timeStr) secondaryLine = `Time ${data.timeStr}`;
  }

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
          {showDesktopActions && (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="h-8 px-3 rounded-full text-sm font-semibold bg-amber-500/60 hover:bg-amber-500/80 text-white border border-white/10 transition-colors"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="h-8 px-3 rounded-full text-sm font-semibold bg-rose-500/65 hover:bg-rose-500/80 text-white border border-white/10 transition-colors"
                >
                  Delete
                </button>
              )}
            </>
          )}

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

      {/* Hlavný text podľa variantu */}
      {isPB ? (
        // PB: veľký čas z DB
        <div className="mt-1 text-2xl font-extrabold tabular-nums leading-none">
          {data.timeStr ?? "—"}
        </div>
      ) : (
        // Activity/Calendar/Plan: veľký názov aktivity/plánu
        <div className="mt-1 text-base font-semibold tracking-tight truncate">
          {data.name}
        </div>
      )}

      {/* Sekundárny riadok */}
      {secondaryLine && (
        <div className="text-sm mt-1 opacity-80">{secondaryLine}</div>
      )}

      {/* Detail (flush) */}
      {opened && (
        cfg.detailFlush ? (
          <div className="-mx-5 -mb-4 mt-3">
            <div className="px-4 pb-4">
              <DetailBody variant={variant} data={data} compactChart={cfg.compactChart} />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <DetailBody variant={variant} data={data} compactChart={cfg.compactChart} />
          </div>
        )
      )}
    </section>
  );
}

/* ===== Detail (KPI + HR graf + splits/laps) ===== */
function DetailBody({
  variant,
  data,
  compactChart,
}: {
  variant: ComponentVariant;
  data: DataIn;
  compactChart: boolean;
}) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  // PLAN: jednoduchý detail bez fetchovania streamov
  if (variant === "plan") {
    return (
      <div>
        {/* KPI pre plan */}
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            data.planDur ? { label: "DURATION", value: data.planDur } : null,
            data.planIntensity ? { label: "INTENSITY", value: data.planIntensity } : null,
            data.planTarget ? { label: "TARGET", value: data.planTarget } : null,
          ]
            .filter(Boolean)
            .map((t: any) => (
              <div key={t.label} className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/20 px-3 py-2">
                <div className="text-[10px] opacity-70">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
              </div>
            ))}
        </div>

        {data.planNotes && (
          <div className="mt-3 text-sm opacity-90">{data.planNotes}</div>
        )}
      </div>
    );
  }

  // ACTIVITY / PB (snažíme sa načítať summary/streams podľa activityId)
  const s = data.activityId != null ? (getSummary(data.activityId) as any | null) : null;

  // KPI – TIME zo summary; fallback PB/secondary čas z data.timeStr
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
      } finally { /* no-op */ }
    })();
    return () => { alive = false; };
  }, [data.activityId, getStreams, getDetail]);

  return (
    <div>
      {/* Veľké KPI */}
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
              height={compactChart ? 148 : 220}
              compact={compactChart}
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