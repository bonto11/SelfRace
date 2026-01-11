"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SURFACE_INLINE } from "@/app/shared/ui/classes";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { ActivityRouteMap } from "@/app/shared/components/trend/ActivityRouteMap";
import { ActivityStreamCharts } from "@/app/shared/components/trend/StreamCharts";
import { StreamsData } from "@/app/features/activities/types/activities";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";

// cesta platí, ak je tento súbor vedľa SessionCard.tsx
import type { ActivitySession } from "./SessionCard";

/** ================= helpers ================= */

type InfoItem = {
  label: string;
  value: string | number | null;
};

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function safeText(value: any): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// workout_type → pekný label
function workoutTypeLabelFromSummary(s: any | null): string | null {
  if (!s || s.workout_type == null) return null;
  const wt = s.workout_type;
  const sport = (
    s.sport_type_ovrd ??
    s.sport_type_fe ??
    s.sport_type ??
    ""
  )
    .toString()
    .toLowerCase();

  if (sport.includes("run")) {
    if (wt === 1) return "Race";
    if (wt === 2) return "Long run";
    if (wt === 3) return "Workout";
    return `Run type ${wt}`;
  }

  if (sport.includes("ride") || sport.includes("bike") || sport.includes("cycle")) {
    if (wt === 1) return "Race";
    if (wt === 2) return "Long ride";
    if (wt === 3) return "Workout";
    return `Ride type ${wt}`;
  }

  return `Type ${wt}`;
}

// kadencia – run → steps/min, bike → rpm
function formatCadenceSummary(s: any | null): string | null {
  if (!s || s.average_cadence_rpm == null) return null;
  const sport = (
    s.sport_type_ovrd ??
    s.sport_type_fe ??
    s.sport_type ??
    ""
  )
    .toString()
    .toLowerCase();

  const rpm = s.average_cadence_rpm;

  if (sport.includes("run")) {
    const spm = Math.round(rpm * 2);
    return `${spm} steps/min`;
  }

  return `${rpm} rpm`;
}

function formatPaceFromSpeedMps(speed?: number | null): string | null {
  if (!speed || speed <= 0) return null;
  const secPerKm = 1000 / speed;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  const secStr = String(seconds).padStart(2, "0");
  return `${minutes}:${secStr} min/km`;
}

/** ============ malý lokálny „accordion“ shell ============ */

type SectionProps = {
  title: string;
  defaultOpen?: boolean;
  items?: InfoItem[];
  children?: ReactNode;
};

function ActivitySectionShell({
  title,
  defaultOpen,
  items,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <section className="mt-3">
      <div className={[SURFACE_INLINE, "px-0 py-0 overflow-hidden"].join(" ")}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold tracking-tight"
        >
          <span>{title}</span>
          <span
            className={[
              "text-base leading-none select-none transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          >
            ▾
          </span>
        </button>

        {open && (
          <div className="border-t border-white/10 px-4 py-3 text-sm">
            {items && items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                {items.map((t) => (
                  <div
                    key={t.label}
                    className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                  >
                    <div className="text-[10px] opacity-70">{t.label}</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {valOrDash(t.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/** ================= main component ================= */

type ActivitySessionDetailProps = {
  item: ActivitySession;
  kpiBlock: ReactNode;
  hasKpis: boolean;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
};

export function ActivitySessionDetail({
  item,
  kpiBlock,
  hasKpis,
  compactChart,
  onOpenActivity,
}: ActivitySessionDetailProps) {
  const act = item;
  const { getSummary, getStreams, getDetail } = useActivityData();

  const s: any | null =
    act.activityId != null ? (getSummary(act.activityId) as any) || null : null;

  const distTxt = s
    ? formatDistance(s.distance_m ?? null)
    : act.distanceStr ?? "—";
  const timeTxt =
    s && s.moving_time_s != null
      ? fmtSecondsHMS(s.moving_time_s)
      : act.timeStr ?? "—";
  const avgHrTxt = s ? s.average_heartrate_bpm ?? "—" : act.avgHr ?? "—";
  const maxHrTxt = s ? s.max_heartrate_bpm ?? "—" : act.maxHr ?? "—";
  const cadenceLabel = formatCadenceSummary(s);
  const workoutTypeLabel = workoutTypeLabelFromSummary(s);
  const paceLabel = formatPaceFromSpeedMps(s?.average_speed_mps);

  const [streams, setStreams] = useState<StreamsData>({
    time_s: [],
    hr: [],
    duration_s: 0,
    cadence_rpm: [],
    power_w: [],
    distance_m: [],
    altitude_m: [],
  });
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>(
    []
  );
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    if (!act.activityId) return;

    (async () => {
      try {
        const st = await getStreams(act.activityId);
        const dt = await getDetail(act.activityId);

        if (!alive) return;

        if (st) {
          const raw: any = st ?? {};

          const time_s: number[] = Array.isArray(raw.time_s)
            ? raw.time_s
            : Array.isArray(raw.time)
            ? raw.time
            : [];

          const hr: (number | null)[] = Array.isArray(raw.hr)
            ? raw.hr
            : Array.isArray(raw.heartrate_bpm)
            ? raw.heartrate_bpm
            : [];

          const cadence_rpm: (number | null)[] =
            Array.isArray(raw.cadence_rpm) && raw.cadence_rpm.length
              ? raw.cadence_rpm
              : Array.isArray(raw.cadence)
              ? raw.cadence
              : [];

          const power_w: (number | null)[] =
            Array.isArray(raw.power_w) && raw.power_w.length
              ? raw.power_w
              : Array.isArray(raw.watts)
              ? raw.watts
              : [];

          const distance_m: (number | null)[] =
            Array.isArray(raw.distance_m) && raw.distance_m.length
              ? raw.distance_m
              : Array.isArray(raw.distance)
              ? raw.distance
              : [];

          const altitude_m: (number | null)[] =
            Array.isArray(raw.altitude_m) && raw.altitude_m.length
              ? raw.altitude_m
              : Array.isArray(raw.altitude)
              ? raw.altitude
              : [];

          const duration_s: number =
            typeof raw.duration_s === "number"
              ? raw.duration_s
              : time_s.length
              ? Number(time_s[time_s.length - 1]) || 0
              : 0;

          const pts: { lat: number; lng: number }[] = [];
          const latlngRaw = raw.latlng;

          if (Array.isArray(latlngRaw)) {
            for (const p of latlngRaw) {
              if (
                Array.isArray(p) &&
                p.length >= 2 &&
                typeof p[0] === "number" &&
                typeof p[1] === "number"
              ) {
                pts.push({ lat: p[0], lng: p[1] });
              } else if (
                p &&
                typeof p.lat === "number" &&
                typeof p.lng === "number"
              ) {
                pts.push({ lat: p.lat, lng: p.lng });
              }
            }
          }

          setStreams({
            time_s,
            hr,
            duration_s,
            cadence_rpm,
            power_w,
            distance_m,
            altitude_m,
          });
          setRoutePoints(pts);
        } else {
          setStreams({
            time_s: [],
            hr: [],
            duration_s: 0,
            cadence_rpm: [],
            power_w: [],
            distance_m: [],
            altitude_m: [],
          });
          setRoutePoints([]);
        }

        if (dt) {
          const anyDt: any = dt;
          setLaps(anyDt.laps || []);
          setSplits(anyDt.splits || []);
        }
      } catch (err) {
        console.error("[ActivitySessionDetail] getStreams/getDetail error", err);
        setStreams({
          time_s: [],
          hr: [],
          duration_s: 0,
          cadence_rpm: [],
          power_w: [],
          distance_m: [],
          altitude_m: [],
        });
        setRoutePoints([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [act.activityId, getStreams, getDetail]);

  /** ====== data pre jednotlivé sekcie ====== */

  const overviewItems: InfoItem[] = [
    { label: "TIME", value: timeTxt },
    { label: "DISTANCE", value: distTxt },
    paceLabel ? { label: "AVG PACE", value: paceLabel } : null,
  ].filter(Boolean) as InfoItem[];

  const hrItems: InfoItem[] = [
    { label: "AVG HR", value: avgHrTxt },
    { label: "MAX HR", value: maxHrTxt },
    // neskôr čas v zónach
  ];

  const elevItems: InfoItem[] = [
    {
      label: "ELEV GAIN",
      value:
        s?.elevation_gain_m != null ? `${s.elevation_gain_m} m` : "—",
    },
    {
      label: "ELEV HIGH",
      value: s?.elev_high_m != null ? `${s.elev_high_m} m` : "—",
    },
    {
      label: "ELEV LOW",
      value: s?.elev_low_m != null ? `${s.elev_low_m} m` : "—",
    },
    cadenceLabel ? { label: "CADENCE", value: cadenceLabel } : null,
  ].filter(Boolean) as InfoItem[];

  const powerItems: InfoItem[] = [
    {
      label: "AVG SPEED",
      value:
        s?.average_speed_mps != null
          ? `${s.average_speed_mps.toFixed(3)} m/s`
          : "—",
    },
    {
      label: "MAX SPEED",
      value:
        s?.max_speed_mps != null
          ? `${s.max_speed_mps.toFixed(3)} m/s`
          : "—",
    },
    {
      label: "AVG POWER",
      value: s?.average_watts != null ? `${s.average_watts} W` : "—",
    },
    {
      label: "MAX POWER",
      value: s?.max_watts != null ? `${s.max_watts} W` : "—",
    },
  ];

  const envItems: InfoItem[] = [
    {
      label: "AVG TEMP",
      value:
        s?.average_temp_c != null ? `${s.average_temp_c} °C` : "—",
    },
    {
      label: "CALORIES",
      value:
        s?.calories_kcal != null ? `${s.calories_kcal} kcal` : "—",
    },
  ];

  const workoutItems: InfoItem[] = [
    { label: "WORKOUT TYPE", value: workoutTypeLabel ?? "—" },
  ];

  return (
    <div>
      {/* KPI z parenta (napr. PB view) */}
      {kpiBlock}

      {/* PREHĽAD – hlavné veci */}
      <ActivitySectionShell
        title="Prehľad"
        defaultOpen={!hasKpis}
        items={overviewItems}
      />

      {/* HEART RATE */}
      <ActivitySectionShell title="Heart rate" items={hrItems} />

      {/* ELEVÁCIA & KADENCIA */}
      <ActivitySectionShell
        title="Elevácia & kadencia"
        items={elevItems}
      />

      {/* RÝCHLOSŤ & VÝKON */}
      <ActivitySectionShell
        title="Rýchlosť & výkon"
        items={powerItems}
      />

      {/* PROSTREDIE & ŠTATISTIKY */}
      <ActivitySectionShell
        title="Prostredie & štatistiky"
        items={envItems}
      />

      {/* TYP TRÉNINGU */}
      <ActivitySectionShell
        title="Typ tréningu"
        items={workoutItems}
      />

      {/* PODROBNÉ GRAFY */}
      <ActivitySectionShell title="Podrobné grafy" defaultOpen>
        <ActivityStreamCharts streams={streams} compact={compactChart} />
      </ActivitySectionShell>

      {/* MAPA TRASY */}
      <ActivitySectionShell title="Mapa trasy">
        <ActivityRouteMap points={routePoints} />
      </ActivitySectionShell>

      {/* SPLITS */}
      <ActivitySectionShell title="Splits">
        {splits.length ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {splits.map((sp: any, idx: number) => (
              <li key={sp.split_index ?? idx}>
                Split {sp.split_index ?? idx}: {formatDistance(sp.distance_m)},
                {" "}
                {fmtSecondsHMS(sp.moving_time_s)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="opacity-80 text-sm">Žiadne splits.</div>
        )}
      </ActivitySectionShell>

      {/* LAPS */}
      <ActivitySectionShell title="Laps">
        {laps.length ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {laps.map((lap: any, idx: number) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {formatDistance(lap.distance_m)},
                {" "}
                {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="opacity-80 text-sm">Žiadne laps.</div>
        )}
      </ActivitySectionShell>

      {/* Akčné tlačidlá + open in activity + poznámka */}

      {"onEdit" in act &&
        (act.onEdit || act.onDelete || act.onToggleFavorite) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {act.onToggleFavorite && (
              <button
                type="button"
                onClick={act.onToggleFavorite}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                {act.isFavorite ? "★ Favorite" : "☆ Set favorite"}
              </button>
            )}
            {act.onEdit && (
              <button
                type="button"
                onClick={act.onEdit}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                Edit
              </button>
            )}
            {act.onDelete && (
              <button
                type="button"
                onClick={act.onDelete}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/20 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}

      {onOpenActivity && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOpenActivity(act.activityId)}
            className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
          >
            Otvoriť aktivitu
          </button>
        </div>
      )}

      {act.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(act.notes)}</div>
      )}
    </div>
  );
}