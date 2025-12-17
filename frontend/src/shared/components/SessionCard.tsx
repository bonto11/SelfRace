// src/shared/components/SessionCard.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import SportBadge from "@/shared/components/ui/SportBadge";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import { SURFACE_CARD, SURFACE_INLINE, FLUSH_DETAIL } from "@/shared/ui/classes";
import { ComponentVariant } from "@/features/activity/utils/activity";

/** ========== Types ========== */

export type SessionKind = "activity" | "plan" | "external";
export type PlanStatus = "planned" | "done" | "missed";

export type KPI = { label: string; value: string };

type Base = {
  id: string | number;
  kind: SessionKind;
  title: string;
  dateIso?: string | null;
  sport: string;

  /** UI behavior */
  defaultOpen?: boolean;
  hideDateLine?: boolean;

  /** calendar-friendly */
  subtitle?: string | null;
  kpis?: KPI[];
  notes?: string | null;
};

export type ActivitySession = Base & {
  kind: "activity";
  activityId: number;

  // fallback values
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;

  /** PB/pinned UI */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;

  /** optional actions */
  onEdit?: () => void;
  onDelete?: () => void;
};

export type PlanSession = Base & {
  kind: "plan";
  status: PlanStatus;

  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;

  planRaw?: any;
  planStructure?: any;
  /** array only (no null) */
  planExercises?: any[];
};

export type ExternalSession = Base & {
  kind: "external";
  time?: string | null;
  durationMin?: number | null;
  notes?: string | null;
};

export type SessionCardItem = ActivitySession | PlanSession | ExternalSession;

export type SessionCardProps = {
  variant?: ComponentVariant; // "activity" | "calendar" | "pb" | "plan"
  item: SessionCardItem;

  onOpenActivity?: (activityId: number) => void;
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

/** target objekt → ľudský string, podporuje starý aj nový tvar */
function tgtToStr(t: any): string | null {
  if (!t) return null;
  if (typeof t === "string") return t;

  const bits: string[] = [];

  // starší tvar
  if (t.pace) bits.push(String(t.pace));
  if (t.power) bits.push(String(t.power));
  if (t.hr) bits.push(String(t.hr));

  // nový AI daily tvar
  if (t.pace_min_per_km) {
    bits.push(`tempo ${t.pace_min_per_km} min/km`);
  }

  if (Array.isArray(t.hr_bpm) && t.hr_bpm.length === 2) {
    const [lo, hi] = t.hr_bpm;
    if (lo && hi) bits.push(`TF ${lo}–${hi} bpm`);
  } else if (typeof t.hr_bpm === "number") {
    bits.push(`TF ${t.hr_bpm} bpm`);
  }

  if (typeof t.power_w === "number") {
    bits.push(`výkon ${t.power_w} W`);
  }

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

  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  // na calendar variante nechceme opakovať dátum vnútri itemu
  const dateLine = item.hideDateLine || variant === "calendar" ? "" : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    // calendar chce subtitle (ak existuje) pred ostatným
    if (variant === "calendar" && item.subtitle) return item.subtitle;

    if (item.kind === "activity") {
      const distKm = parseKm(item.distanceStr);
      if (distKm != null && distKm > 0 && item.distanceStr) return `Distance ${item.distanceStr}`;
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
  }, [item, variant]);

  return (
    <section className={[SURFACE_CARD, "overflow-hidden", cfg.outerPadding].join(" ")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{dateLine}</div>

        <div className="flex items-center gap-2">
          {item.kind === "activity" && (item as ActivitySession).isFavorite && (
            <span className="text-[12px] leading-none opacity-90" title="Favorite">
              ★
            </span>
          )}

          {item.kind === "plan" && (
            <span
              className={[
                "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                statusCls((item as PlanSession).status),
              ].join(" ")}
            >
              {statusLabel((item as PlanSession).status)}
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
            <span className={["text-base leading-none select-none transition-transform", opened ? "rotate-180" : ""].join(" ")}>
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
            variant={variant}
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

/** ========== Detail ========== */

function DetailBody({
  variant,
  item,
  compactChart,
  onOpenActivity,
  showPlanDebug,
}: {
  variant: ComponentVariant;
  item: SessionCardItem;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
}) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  const kpis = Array.isArray(item.kpis) ? item.kpis : [];
  const hasKpis = kpis.length > 0;

  const kpiBlock = hasKpis ? (
    <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
          <div className="text-[10px] opacity-70">{k.label}</div>
          <div className="text-xl font-semibold tabular-nums">{k.value}</div>
        </div>
      ))}
    </div>
  ) : null;

  // -------- PLAN --------
  if (item.kind === "plan") {
    const planItem = item as PlanSession;
    const raw = planItem.planRaw ?? undefined;
    const structure = planItem.planStructure ?? raw?.structure ?? undefined;

    // strength – podpor oba tvary: planExercises, structure.strength_exercises, raw.exercises
    let exercises: any[] = [];
    if (Array.isArray(planItem.planExercises)) {
      exercises = planItem.planExercises;
    } else if (Array.isArray(structure?.strength_exercises)) {
      exercises = structure.strength_exercises;
    } else if (Array.isArray(raw?.exercises)) {
      exercises = raw.exercises;
    }

    const wu = structure?.warmup ?? undefined;
    const cd = structure?.cooldown ?? undefined;
    const mainBlocks: any[] = Array.isArray(structure?.main)
      ? structure.main
      : structure?.main
      ? [structure.main]
      : [];

    return (
      <div>
        {kpiBlock}

        {/* fallback KPI pre plan (ak neprídu calendar kpis) */}
        {!hasKpis && (
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              planItem.planDur ? { label: "DURATION", value: planItem.planDur } : null,
              planItem.planIntensity ? { label: "INTENSITY", value: planItem.planIntensity } : null,
              planItem.planTarget ? { label: "TARGET", value: planItem.planTarget } : null,
            ]
              .filter(Boolean)
              .map((t: any) => (
                <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-[10px] opacity-70">{t.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
                </div>
              ))}
          </div>
        )}

        {(wu || mainBlocks.length || cd) && (
          <div className="mt-4 space-y-3">
            {wu && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">WARM-UP</div>
                <div className="text-sm mt-0.5">
                  {[fmtMin(wu.minutes), wu.notes].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            )}

            {mainBlocks.length > 0 && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">MAIN</div>
                <div className="text-sm mt-0.5 space-y-1">
                  {mainBlocks.map((mn: any, idx: number) => (
                    <div
                      key={idx}
                      className={idx === 0 ? "" : "border-t border-white/5 pt-0.5 mt-0.5"}
                    >
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
                  ))}
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
                      e?.slot ? String(e.slot) : null,
                      e?.sets ? `${e.sets} série` : null,
                      e?.reps ? `${e.reps} opak.` : null,
                      e?.seconds ? `${e.seconds}s` : null,
                      e?.rest_s ?? e?.rest_sec
                        ? `pauza ${e.rest_s ?? e.rest_sec}s`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                  {e?.notes && (
                    <div className="mt-0.5 text-xs opacity-90">{e.notes}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(planItem.planNotes || planItem.notes) && (
          <div className="mt-3 text-sm opacity-90">
            {(planItem.planNotes ?? planItem.notes) as any}
          </div>
        )}

        {showPlanDebug && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
              Plan debug
            </div>
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
    const extItem = item as ExternalSession;

    return (
      <div>
        {kpiBlock}

        {!hasKpis && (
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              extItem.time ? { label: "TIME", value: extItem.time } : null,
              extItem.durationMin != null
                ? { label: "DURATION", value: `${extItem.durationMin} min` }
                : null,
            ]
              .filter(Boolean)
              .map((t: any) => (
                <div key={t.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-[10px] opacity-70">{t.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{String(t.value)}</div>
                </div>
              ))}
          </div>
        )}

        {(extItem.notes ?? null) && (
          <div className="mt-3 text-sm opacity-90">{extItem.notes}</div>
        )}
      </div>
    );
  }

  // -------- ACTIVITY --------
  const actItem = item as ActivitySession;
  const s = actItem.activityId != null ? (getSummary(actItem.activityId) as any | null) : null;

  const distTxt = s ? fmtDistance(s.distance_m ?? null) : actItem.distanceStr ?? "—";
  const timeTxt =
    s && s.moving_time_s != null ? fmtSecondsHMS(s.moving_time_s) : actItem.timeStr ?? "—";
  const avgTxt = s ? s.average_heartrate_bpm ?? "—" : actItem.avgHr ?? "—";
  const maxTxt = s ? s.max_heartrate_bpm ?? "—" : actItem.maxHr ?? "—";

  const [streams, setStreams] = useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number }>({
    time_s: [],
    hr: [],
    duration_s: 0,
  });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    if (!actItem.activityId) return;

    (async () => {
      try {
        const st = await getStreams(actItem.activityId);
        const dt = await getDetail(actItem.activityId);
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
  }, [actItem.activityId, getStreams, getDetail]);

  return (
    <div>
      {kpiBlock}

      {/* fallback KPI pre activity (ak neprídu calendar kpis) */}
      {!hasKpis && (
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
      )}

      {/* PB actions */}
      {"onEdit" in actItem &&
        (actItem.onEdit || actItem.onDelete || actItem.onToggleFavorite) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actItem.onToggleFavorite && (
              <button
                type="button"
                onClick={actItem.onToggleFavorite}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                {actItem.isFavorite ? "★ Favorite" : "☆ Set favorite"}
              </button>
            )}
            {actItem.onEdit && (
              <button
                type="button"
                onClick={actItem.onEdit}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                Edit
              </button>
            )}
            {actItem.onDelete && (
              <button
                type="button"
                onClick={actItem.onDelete}
                className="h-8 px-3 rounded-full text-sm font-semibold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/20 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}

      {/* CTA (napr z kalendára) */}
      {onOpenActivity && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOpenActivity(actItem.activityId)}
            className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
          >
            Otvoriť aktivitu
          </button>
        </div>
      )}

      {/* notes */}
      {actItem.notes && <div className="mt-3 text-sm opacity-90">{actItem.notes}</div>}

      {/* HR priebeh */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold">HR priebeh</h4>
        </div>

        {streams.time_s.length ? (
          <div className="mb-1">
            <HrChart xs={streams.time_s} ys={streams.hr} height={compactChart ? 148 : 220} compact={compactChart} />
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

      {/* (voliteľne) debug pre calendar pri potrebe */}
      {variant === "calendar" && showPlanDebug && (
        <details className="mt-4">
          <summary className="text-xs opacity-70 cursor-pointer">Debug JSON</summary>
          <pre className="mt-2 text-[11px] opacity-90 whitespace-pre-wrap break-words">
            {JSON.stringify((item as any).raw ?? item, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}