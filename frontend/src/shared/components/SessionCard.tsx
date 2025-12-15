// src/shared/components/SessionCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import SportBadge from "@/shared/components/ui/SportBadge";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import { SURFACE_CARD, SURFACE_INLINE, FLUSH_DETAIL } from "@/shared/ui/classes";
import { ComponentVariant } from "@/features/activity/utils/activity";

/** ========== Common types ========== */

export type SessionKind = "activity" | "plan" | "external";

export type PlanStatus = "planned" | "done" | "missed";

type Base = {
  id: string | number;
  kind: SessionKind;
  title: string;
  dateIso?: string | null;
  sport: string;

  /** UI behavior */
  defaultOpen?: boolean;
  /** v kalendári často nechceš opakovať dátum vnútri itemu */
  hideDateLine?: boolean;
};

export type ActivitySession = Base & {
  kind: "activity";
  activityId: number;

  // rýchle hodnoty (fallback kým nenabehne summary)
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;

  /** napr. v table: ak je to single-day, môžeš potlačiť header (zatiaľ len forward-compat) */
  singleDayContext?: boolean;
};

export type PlanSession = Base & {
  kind: "plan";
  status: PlanStatus;

  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;

  /** raw z AI – nech máme do budúcna */
  planRaw?: any;
  planStructure?: any;
  planExercises?: any[];
};

export type ExternalSession = Base & {
  kind: "external";
  time?: string | null;
  notes?: string | null;
  durationMin?: number | null;
};

export type SessionCardItem = ActivitySession | PlanSession | ExternalSession;

export type SessionCardProps = {
  variant?: ComponentVariant; // "activity" | "calendar" | "pb" | "plan"
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void; // optional CTA
  /** dočasné: ukáže JSON debug pre plan (default false) */
  showPlanDebug?: boolean;
};

const PRESET: Record<ComponentVariant, { outerPadding: string; compactChart: boolean }> = {
  activity: { outerPadding: "px-5 py-4", compactChart: false },
  calendar: { outerPadding: "px-5 py-4", compactChart: true },
  pb: { outerPadding: "px-5 py-4", compactChart: true },
  plan: { outerPadding: "px-5 py-4", compactChart: true },
};

/** ========== Helpers ========== */

function prettySkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function statusLabel(status: PlanStatus): string {
  if (status === "done") return "hotovo";
  if (status === "missed") return "missed";
  return "planned";
}

function statusCls(status: PlanStatus): string {
  if (status === "done") return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (status === "missed") return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

/** vyparsuje km zo stringu typu "6.08 km" */
function parseKm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*km/i);
  if (!m) return null;
  return Number(String(m[1]).replace(",", "."));
}

function fmtMin(m?: number) {
  return typeof m === "number" && m > 0 ? `${m} min` : null;
}

function tgtToStr(t: any): string | null {
  if (!t) return null;
  if (typeof t === "string") return t;
  const bits = [t?.pace, t?.power, t?.hr].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

/** ========== Component ========== */

export default function SessionCard({
  variant = "activity",
  item,
  onOpenActivity,
  showPlanDebug = false,
}: SessionCardProps) {
  const cfg = PRESET[variant];
  const [opened, setOpened] = useState<boolean>(!!item.defaultOpen);

  // keď sa zmení defaultOpen (napr autoOpen v ActivityTable), nech to reaguje
  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  const dateLine = item.hideDateLine || variant === "calendar" ? "" : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    if (item.kind === "activity") {
      const distKm = parseKm(item.distanceStr);
      if (distKm != null && distKm > 0) return `Distance ${item.distanceStr}`;
      if (item.timeStr) return `Time ${item.timeStr}`;
      return null;
    }
    if (item.kind === "plan") {
      const bits = [item.planDur ?? "", item.planIntensity ?? "", item.planTarget ?? ""].filter(Boolean);
      return bits.length ? bits.join(" · ") : null;
    }
    // external
    const bits = [
      item.time ? item.time : null,
      item.durationMin != null ? `${item.durationMin} min` : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : null;
  }, [item]);

  return (
    <section className={[SURFACE_CARD, "overflow-hidden", cfg.outerPadding].join(" ")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{dateLine}</div>

        <div className="flex items-center gap-2">
          {item.kind === "plan" && (
            <span
              className={[
                "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                statusCls(item.status),
              ].join(" ")}
            >
              {statusLabel(item.status)}
            </span>
          )}

          <SportBadge sport={item.sport} />

          <button
            type="button"
            aria-expanded={opened}
            onClick={() => setOpened((s) => !s)}
            title={opened ? "Skryť detail" : "Otvoriť detail"}
            className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span
              className={[
                "text-base leading-none select-none transition-transform",
                opened ? "rotate-180" : "",
              ].join(" ")}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">{item.title}</div>

      {/* Secondary line */}
      {secondaryLine && <div className="text-sm mt-1 opacity-80">{secondaryLine}</div>}

      {/* Detail */}
      {opened && (
        <div className={FLUSH_DETAIL}>
          <DetailBody
            item={item}
            compactChart={cfg.compactChart}
            onOpenActivity={onOpenActivity}
            showPlanDebug={showPlanDebug}
          />
        </div>
      )}
    </section>
  );
}

/** ========== Detail render ========== */

function DetailBody({
  item,
  compactChart,
  onOpenActivity,
  showPlanDebug,
}: {
  item: SessionCardItem;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
}) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  // -------- PLAN --------
  if (item.kind === "plan") {
    const raw = item.planRaw ?? null;
    const structure = item.planStructure ?? raw?.structure ?? null;
    const exercises = item.planExercises ?? raw?.exercises ?? null;

    const wu = structure?.warmup ?? null;
    const mn = structure?.main ?? null;
    const cd = structure?.cooldown ?? null;

    return (
      <div>
        {/* KPI */}
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            item.planDur ? { label: "DURATION", value: item.planDur } : null,
            item.planIntensity ? { label: "INTENSITY", value: item.planIntensity } : null,
            item.planTarget ? { label: "TARGET", value: item.planTarget } : null,
          ]
            .filter(Boolean)
            .map((t: any) => (
              <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[10px] opacity-70">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
              </div>
            ))}
        </div>

        {/* Structured blocks (WU / MAIN / CD) */}
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
                    ].filter(Boolean).join(" · ") || "—"}
                  </div>

                  {tgtToStr(mn.target) && <div className="opacity-90">target: {tgtToStr(mn.target)}</div>}
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

        {/* Exercises */}
        {Array.isArray(exercises) && exercises.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold opacity-80 mb-1.5">EXERCISES</div>
            <ul className="space-y-1.5">
              {exercises.map((e: any, i: number) => (
                <li key={`${e?.name ?? "ex"}-${i}`} className="rounded-md border border-white/10 px-3 py-2">
                  <div className="text-sm font-medium">{e?.name ?? `Exercise ${i + 1}`}</div>
                  <div className="text-xs opacity-85 mt-0.5">
                    {[
                      e?.sets ? `${e.sets} sets` : null,
                      e?.reps ? `${e.reps} reps` : null,
                      e?.rest_sec ? `rest ${e.rest_sec}s` : null,
                    ].filter(Boolean).join(" · ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {item.planNotes && <div className="mt-3 text-sm opacity-90">{item.planNotes}</div>}

        {/* Optional debug */}
        {showPlanDebug && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">Plan debug</div>
            <pre className="text-[11px] whitespace-pre-wrap break-words opacity-85">
              {JSON.stringify({ structure, exercises, raw }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // -------- EXTERNAL --------
  if (item.kind === "external") {
    return (
      <div>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            item.time ? { label: "TIME", value: item.time } : null,
            item.durationMin != null ? { label: "DURATION", value: `${item.durationMin} min` } : null,
          ]
            .filter(Boolean)
            .map((t: any) => (
              <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[10px] opacity-70">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
              </div>
            ))}
        </div>

        {item.notes && <div className="mt-3 text-sm opacity-90">{item.notes}</div>}
      </div>
    );
  }

  // -------- ACTIVITY --------
  const s = item.activityId != null ? (getSummary(item.activityId) as any | null) : null;

  const distTxt = s ? fmtDistance(s.distance_m ?? null) : item.distanceStr ?? "—";
  const timeTxt =
    s && s.moving_time_s != null ? fmtSecondsHMS(s.moving_time_s) : item.timeStr ?? "—";
  const avgTxt = s ? s.average_heartrate_bpm ?? "—" : item.avgHr ?? "—";
  const maxTxt = s ? s.max_heartrate_bpm ?? "—" : item.maxHr ?? "—";

  const [streams, setStreams] = useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number }>({
    time_s: [],
    hr: [],
    duration_s: 0,
  });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    if (!item.activityId) return;

    (async () => {
      try {
        const st = await getStreams(item.activityId);
        const dt = await getDetail(item.activityId);
        if (!alive) return;
        if (st) setStreams(st as any);
        if (dt) {
          setLaps((dt as any).laps || []);
          setSplits((dt as any).splits || []);
        }
      } catch {
        // ticho
      }
    })();

    return () => {
      alive = false;
    };
  }, [item.activityId, getStreams, getDetail]);

  return (
    <div>
      {/* KPI */}
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "TIME", value: timeTxt },
          { label: "DISTANCE", value: distTxt },
          { label: "AVG HR", value: avgTxt },
          { label: "MAX HR", value: maxTxt },
        ].map((t) => (
          <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
            <div className="text-[10px] opacity-70">{t.label}</div>
            <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
          </div>
        ))}
      </div>

      {/* CTA (voliteľné, napr z kalendára) */}
      {onOpenActivity && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOpenActivity(item.activityId)}
            className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
          >
            Otvoriť aktivitu
          </button>
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
                Split {sp.split_index ?? idx}: {fmtDistance(sp.distance_m)},{" "}
                {fmtSecondsHMS(sp.moving_time_s)}
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
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)},{" "}
                {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}