"use client";

import { useEffect, useState } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import { ComponentVariant } from "@/features/activity/utils/activity";
import { SURFACE_CARD, SURFACE_INLINE, FLUSH_DETAIL } from "@/shared/ui/classes";
import {THEME} from "@/shared/theme/tokens";
import SportBadge from "@/shared/components/ui/SportBadge"

/* ===== Typy vstupu ===== */
type DataIn = {
  id: string | number;
  name: string;
  dateIso?: string | null;
  sport: "run" | "ride" | "strength" | "mixed" | "other" | string;

  // ACTIVITY / PB
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activityId?: number | null;

  // PLAN (AI coach)
  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;

  planStructure?: {
    warmup?: { minutes?: number; notes?: string };
    main?: {
      reps?: number;
      work_min?: number;
      recover_min?: number;
      target?: { pace?: string; power?: string; hr?: string } | string | null;
      notes?: string;
    };
    cooldown?: { minutes?: number; notes?: string };
  } | null;

  planExercises?: Array<{ name?: string; sets?: number; reps?: number; rest_sec?: number }> | null;

  // fallback – ak nechceš mapovať zvlášť, pošli sem celý AI item; vytiahnem z neho, čo treba
  planRaw?: any;

  singleDayContext?: boolean;
};

export type ActivitySingleProps = {
  variant?: ComponentVariant;     // "activity" | "calendar" | "pb" | "plan"
  data: DataIn;
  defaultOpen?: boolean;

  /** voliteľné akcie – použijú sa iba na DESKTOPE (náhrada za swipe) */
  onEdit?: () => void;
  onDelete?: () => void;

  /** PB favorite (voliteľné; bezpečné defaulty) */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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

const SPORT_COLORS: Record<string, string> = {
  run: THEME.chart.run,
  ride: THEME.chart.ride,
  swim: THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed: THEME.chart.mixed,
  skate: THEME.chart.skate,
  walk: THEME.chart.walk,
  other: THEME.chart.other,
};

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
    } catch {
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
  isFavorite,
  onToggleFavorite,
}: ActivitySingleProps) {
  const cfg = PRESET[variant];
  const [opened, setOpened] = useState<boolean>(defaultOpen);
  const isPB   = variant === "pb";
  const isPlan = variant === "plan";
  const isTouch = useIsTouch();
  const showDesktopActions = !isTouch && (!!onEdit || !!onDelete);

  // Header: vľavo dátum – skry v kalendári, inak zobraz
  const headerLeft = variant === "calendar" ? "" : prettySkDate(data.dateIso ?? null);

  // Sekundárna línia
  const distKm = parseKm(data.distanceStr);
  let secondaryLine: string | null = null;
  if (isPB) {
    secondaryLine = data.distanceStr ? `Distance ${data.distanceStr}` : null;
  } else if (isPlan) {
    const bits = [data.planDur ?? "", data.planIntensity ?? "", data.planTarget ?? ""].filter(Boolean);
    secondaryLine = bits.length ? bits.join(" · ") : null;
  } else {
    if (distKm != null && distKm > 0) secondaryLine = `Distance ${data.distanceStr}`;
    else if (data.timeStr) secondaryLine = `Time ${data.timeStr}`;
  }

  return (
    <section className={[SURFACE_CARD, "overflow-hidden", cfg.outerPadding].join(" ")}>
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

          {/* ★ Favorite pre PB – voliteľné, nezasiahne iné použitia */}
          {isPB && onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              title={isFavorite ? "Unfavorite" : "Set as favorite"}
              aria-pressed={!!isFavorite}
              className={[
                "h-8 w-8 grid place-items-center rounded-full border transition-colors",
                isFavorite
                  ? "bg-amber-400 text-black border-white/10 hover:bg-amber-300"
                  : "bg-white/10 hover:bg-white/20 border-white/10 text-white",
              ].join(" ")}
            >
              <span className="text-base leading-none">{isFavorite ? "★" : "☆"}</span>
            </button>
          )}

          <SportBadge sport={data.sport} />

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
        <div className="mt-1 text-2xl font-extrabold tabular-nums leading-none">
          {data.timeStr ?? "—"}
        </div>
      ) : (
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
        <div className={FLUSH_DETAIL}>
          <DetailBody variant={variant} data={data} compactChart={cfg.compactChart} />
        </div>
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

 // PLAN: renderujeme štruktúru (run) a cviky (strength), ak sú k dispozícii
  if (variant === "plan") {
    const raw = (data as any).planRaw ?? null;

    // preferuj explicitné polia; fallbackni na raw
    const structure = (data as any).planStructure ?? raw?.structure ?? null;
    const exercises = (data as any).planExercises ?? raw?.exercises ?? null;

    // helpers
    const fmtMin = (m?: number) => (typeof m === "number" && m > 0 ? `${m} min` : null);
    const tgtToStr = (t: any): string | null => {
      if (!t) return null;
      if (typeof t === "string") return t;
      const bits = [t?.pace, t?.power, t?.hr].filter(Boolean);
      return bits.length ? bits.join(" · ") : null;
    };

    const wu = structure?.warmup ?? null;
    const mn = structure?.main ?? null;
    const cd = structure?.cooldown ?? null;

    return (
      <div>
        {/* KPI chips (zachované) */}
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            data.planDur ? { label: "DURATION", value: data.planDur } : null,
            data.planIntensity ? { label: "INTENSITY", value: data.planIntensity } : null,
            data.planTarget ? { label: "TARGET", value: data.planTarget } : null,
          ]
            .filter(Boolean)
            .map((t: any) => (
              <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[10px] opacity-70">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
              </div>
            ))}
        </div>

        {/* --- RUN: Warm-up / Main / Cool-down --- */}
        {(wu || mn || cd) && (
          <div className="mt-4 space-y-3">
            {wu && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">WARM-UP</div>
                <div className="text-sm mt-0.5">
                  {[fmtMin(wu.minutes), wu.notes].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            )}

            {mn && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">MAIN</div>
                <div className="text-sm mt-0.5 space-y-0.5">
                  <div>
                    {[
                      mn.reps ? `${mn.reps}×` : null,
                      fmtMin(mn.work_min),
                      mn.recover_min ? `rec ${mn.recover_min} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                  {tgtToStr(mn.target) && (
                    <div className="opacity-90">target: {tgtToStr(mn.target)}</div>
                  )}
                  {mn.notes && <div className="opacity-90">{mn.notes}</div>}
                </div>
              </div>
            )}

            {cd && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">COOL-DOWN</div>
                <div className="text-sm mt-0.5">
                  {[fmtMin(cd.minutes), cd.notes].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- STRENGTH: zoznam cvikov --- */}
        {Array.isArray(exercises) && exercises.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold opacity-80 mb-1.5">EXERCISES</div>
            <ul className="space-y-1.5">
              {exercises.map((e: any, i: number) => (
                <li
                  key={`${e?.name ?? "ex"}-${i}`}
                  className="rounded-md border border-white/10 px-3 py-2"
                >
                  <div className="text-sm font-medium">{e?.name ?? `Exercise ${i + 1}`}</div>
                  <div className="text-xs opacity-85 mt-0.5">
                    {[
                      e?.sets ? `${e.sets} sets` : null,
                      e?.reps ? `${e.reps} reps` : null,
                      e?.rest_sec ? `rest ${e.rest_sec}s` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* poznámky na záver (ak ostali) */}
        {data.planNotes && (
          <div className="mt-4 text-sm opacity-90">{data.planNotes}</div>
        )}
      </div>
    );
  }

  // ACTIVITY / PB (načíta summary/streams podľa activityId)
  const s = data.activityId != null ? (getSummary(data.activityId) as any | null) : null;

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
      {/* KPI */}
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "TIME", value: timeTxt },
          { label: "DISTANCE", value: distTxt },
          { label: "AVG HR", value: avgTxt },
          { label: "MAX HR", value: maxTxt },
        ].map(t => (
          <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
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