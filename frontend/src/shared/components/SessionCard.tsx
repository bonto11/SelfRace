// src/shared/components/SessionCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import HrChart from "@/shared/components/trend/HrChart";
import SportBadge from "@/shared/components/ui/SportBadge";
import { formatDistance } from "@/shared/utils/distance";
import { fmtSecondsHMS } from "@/shared/utils/time";
import {
  SURFACE_CARD,
  SURFACE_INLINE,
  FLUSH_DETAIL,
} from "@/shared/ui/classes";
import { ComponentVariant } from "@/features/activities/types/activities";

/** ========== Types ========== */

export type SessionKind = "activity" | "plan" | "external";
export type PlanStatus = "planned" | "done" | "missed";

export type KPI = { label: string; value: any };

type Base = {
  id: string | number;
  kind: SessionKind;
  title: string;
  dateIso?: string | null;
  sport: string;

  defaultOpen?: boolean;
  hideDateLine?: boolean;

  subtitle?: string | null;
  kpis?: KPI[];
  notes?: string | null;
};

export type ActivitySession = Base & {
  kind: "activity";
  activityId: number;

  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;

  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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

const PRESET: Record<
  ComponentVariant,
  { outerPadding: string; compactChart: boolean }
> = {
  activity: { outerPadding: "px-5 py-4", compactChart: false },
  calendar: { outerPadding: "px-5 py-4", compactChart: true },
  pb: { outerPadding: "px-5 py-4", compactChart: true },
  plan: { outerPadding: "px-5 py-4", compactChart: true },
};

/** ========== Helpers ========== */

function prettySkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function statusLabel(status: PlanStatus): string {
  if (status === "done") return "hotovo";
  if (status === "missed") return "missed";
  return "planned";
}
function statusCls(status: PlanStatus): string {
  if (status === "done")
    return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (status === "missed")
    return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

function parseKm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*km/i);
  if (!m) return null;
  return Number(String(m[1]).replace(",", "."));
}

function fmtMin(m?: number) {
  return typeof m === "number" && m > 0 ? `${m} min` : null;
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

  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  const dateLine =
    item.hideDateLine || variant === "calendar"
      ? ""
      : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    if (variant === "calendar" && item.subtitle) return item.subtitle;

    if (item.kind === "activity") {
      const act = item as ActivitySession;
      const distKm = parseKm(act.distanceStr);
      if (distKm != null && distKm > 0 && act.distanceStr)
        return `Distance ${act.distanceStr}`;
      if (act.timeStr) return `Time ${act.timeStr}`;
      return null;
    }

    if (item.kind === "plan") {
      const plan = item as PlanSession;
      const bits = [
        plan.planDur ?? "",
        plan.planIntensity ?? "",
        plan.planTarget ?? "",
      ].filter(Boolean);
      return bits.length ? bits.join(" · ") : null;
    }

    const ext = item as ExternalSession;
    const bits = [
      ext.time ? ext.time : null,
      ext.durationMin != null ? `${ext.durationMin} min` : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : null;
  }, [item, variant]);

  return (
    <section
      className={[SURFACE_CARD, "overflow-hidden", cfg.outerPadding].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{dateLine}</div>

        <div className="flex items-center gap-2">
          {item.kind === "activity" && (item as ActivitySession).isFavorite && (
            <span
              className="text-[12px] leading-none opacity-90"
              title="Favorite"
            >
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
      <div className="mt-1 text-base font-semibold tracking-tight truncate">
        {item.title}
      </div>

      {/* Secondary line */}
      {secondaryLine && (
        <div className="text-sm mt-1 opacity-80">{secondaryLine}</div>
      )}

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
        <div
          key={String(k.label)}
          className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
        >
          <div className="text-[10px] opacity-70">{safeText(k.label)}</div>
          <div className="text-xl font-semibold tabular-nums">
            {safeText(k.value)}
          </div>
        </div>
      ))}
    </div>
  ) : null;

  // -------- PLAN --------
  if (item.kind === "plan") {
    const plan = item as PlanSession;

    const raw = plan.planRaw ?? undefined;
    const structure = plan.planStructure ?? raw?.structure ?? undefined;

    // preferuj: plan.planExercises → structure.strength_exercises → raw.strength_exercises
    const exercises =
      Array.isArray(plan.planExercises) && plan.planExercises.length > 0
        ? plan.planExercises
        : Array.isArray((structure as any)?.strength_exercises) &&
          (structure as any).strength_exercises.length > 0
        ? (structure as any).strength_exercises
        : Array.isArray((raw as any)?.strength_exercises)
        ? (raw as any).strength_exercises
        : [];

    const wu = (structure as any)?.warmup ?? undefined;
    const mainBlocks: any[] = Array.isArray((structure as any)?.main)
      ? (structure as any).main
      : (structure as any)?.main
      ? [(structure as any).main]
      : [];
    const cd = (structure as any)?.cooldown ?? undefined;

    console.log("[SessionCard] PLAN item", {
      title: plan.title,
      planDur: plan.planDur,
      planIntensity: plan.planIntensity,
      planTarget: plan.planTarget,
      raw,
      structure,
    });
    console.log("[SessionCard] PLAN exercises", {
      title: plan.title,
      count: Array.isArray(exercises) ? exercises.length : 0,
      sample:
        Array.isArray(exercises) && exercises.length > 0
          ? exercises[0]
          : undefined,
    });

    return (
      <div>
        {kpiBlock}

        {/* fallback KPI pre plan (ak neprídu calendar kpis) */}
        {!hasKpis && (
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              plan.planDur ? { label: "DURATION", value: plan.planDur } : null,
              plan.planIntensity
                ? { label: "INTENSITY", value: plan.planIntensity }
                : null,
              plan.planTarget
                ? { label: "TARGET", value: plan.planTarget }
                : null,
            ]
              .filter(Boolean)
              .map((t: any) => (
                <div
                  key={t.label}
                  className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                >
                  <div className="text-[10px] opacity-70">
                    {safeText(t.label)}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {safeText(t.value)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {(wu || mainBlocks.length || cd) && (
          <div className="mt-4 space-y-3">
            {wu && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">
                  WARM-UP
                </div>
                <div className="text-sm mt-0.5">
                  {[
                    fmtMin((wu as any).minutes),
                    typeof (wu as any).notes === "string"
                      ? (wu as any).notes
                      : (wu as any).notes != null
                      ? safeText((wu as any).notes)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            )}

            {mainBlocks.length > 0 && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">MAIN</div>
                <div className="text-sm mt-0.5 space-y-1">
                  {mainBlocks.map((mn: any, idx: number) => {
                    const line =
                      [
                        mn?.reps ? `${mn.reps}×` : null,
                        fmtMin(mn?.work_min),
                        mn?.recover_min ? `rec ${mn.recover_min} min` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—";

                    const tgt = tgtToStr(mn?.target);
                    const noteText =
                      typeof mn?.notes === "string"
                        ? mn.notes
                        : mn?.notes != null
                        ? safeText(mn.notes)
                        : null;

                    return (
                      <div
                        key={idx}
                        className="border-t border-white/5 pt-1 first:border-t-0 first:pt-0"
                      >
                        <div>{line}</div>
                        {tgt && <div className="opacity-90">target: {tgt}</div>}
                        {noteText && (
                          <div className="opacity-90">{noteText}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cd && (
              <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                <div className="text-[11px] font-semibold opacity-80">
                  COOL-DOWN
                </div>
                <div className="text-sm mt-0.5">
                  {[
                    fmtMin((cd as any).minutes),
                    typeof (cd as any).notes === "string"
                      ? (cd as any).notes
                      : (cd as any).notes != null
                      ? safeText((cd as any).notes)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            )}
          </div>
        )}

        {Array.isArray(exercises) && exercises.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold opacity-80 mb-1.5">
              EXERCISES
            </div>
            <ul className="space-y-1.5">
              {exercises.map((e: any, i: number) => {
                const name =
                  e?.exercise_name || e?.name || `Exercise ${i + 1}`;

                const parts = [
                  e?.sets ? `${e.sets} sets` : null,
                  e?.reps ? `${e.reps} reps` : null,
                  e?.seconds ? `${e.seconds}s` : null,
                  e?.rest_sec
                    ? `rest ${e.rest_sec}s`
                    : e?.rest_s
                    ? `rest ${e.rest_s}s`
                    : null,
                ].filter(Boolean);

                const line = parts.length ? parts.join(" · ") : "—";

                const notesText =
                  typeof e?.notes === "string"
                    ? e.notes
                    : e?.notes != null
                    ? safeText(e.notes)
                    : null;

                return (
                  <li
                    key={`${name}-${i}`}
                    className="rounded-md border border-white/10 px-3 py-2"
                  >
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs opacity-85 mt-0.5">{line}</div>
                    {notesText && (
                      <div className="text-xs opacity-85 mt-0.5">
                        {notesText}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(plan.planNotes || plan.notes) && (
          <div className="mt-3 text-sm opacity-90">
            {safeText(plan.planNotes ?? plan.notes)}
          </div>
        )}

        {showPlanDebug && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
              Plan debug
            </div>
            <pre className="text-[11px] whitespace-pre-wrap break-words opacity-85">
              {safeText({ structure, exercises, raw })}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // -------- EXTERNAL --------
  if (item.kind === "external") {
    const ext = item as ExternalSession;
    return (
      <div>
        {kpiBlock}

        {!hasKpis && (
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ext.time ? { label: "TIME", value: ext.time } : null,
              ext.durationMin != null
                ? { label: "DURATION", value: `${ext.durationMin} min` }
                : null,
            ]
              .filter(Boolean)
              .map((t: any) => (
                <div
                  key={t.label}
                  className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                >
                  <div className="text-[10px] opacity-70">
                    {safeText(t.label)}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {safeText(t.value)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {(ext.notes ?? null) && (
          <div className="mt-3 text-sm opacity-90">
            {safeText(ext.notes)}
          </div>
        )}
      </div>
    );
  }

  // -------- ACTIVITY --------
  const act = item as ActivitySession;

  const s =
    act.activityId != null
      ? (getSummary(act.activityId) as any) || null
      : null;

  const distTxt = s
    ? formatDistance(s.distance_m ?? null)
    : act.distanceStr ?? "—";
  const timeTxt =
    s && s.moving_time_s != null
      ? fmtSecondsHMS(s.moving_time_s)
      : act.timeStr ?? "—";
  const avgTxt = s ? s.average_heartrate_bpm ?? "—" : act.avgHr ?? "—";
  const maxTxt = s ? s.max_heartrate_bpm ?? "—" : act.maxHr ?? "—";

  const [streams, setStreams] = useState<{
    time_s: number[];
    hr: (number | null)[];
    duration_s: number;
  }>({
    time_s: [],
    hr: [],
    duration_s: 0,
  });
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

        console.log("[SessionCard] streams raw", act.activityId, st);
        console.log("[SessionCard] detail raw", act.activityId, dt);

        if (st) {
          const raw: any = st;

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

          const duration_s: number =
            typeof raw.duration_s === "number"
              ? raw.duration_s
              : time_s.length
              ? Number(time_s[time_s.length - 1]) || 0
              : 0;

          setStreams({ time_s, hr, duration_s });
        } else {
          console.log("[SessionCard] no streams for", act.activityId);
          setStreams({ time_s: [], hr: [], duration_s: 0 });
        }

        if (dt) {
          const anyDt: any = dt;
          setLaps(anyDt.laps || []);
          setSplits(anyDt.splits || []);
        }
      } catch (err) {
        console.error("[SessionCard] getStreams/getDetail error", err);
        setStreams({ time_s: [], hr: [], duration_s: 0 });
      }
    })();

    return () => {
      alive = false;
    };
  }, [act.activityId, getStreams, getDetail]);

  return (
    <div>
      {kpiBlock}

      {!hasKpis && (
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { label: "TIME", value: timeTxt },
            { label: "DISTANCE", value: distTxt },
            { label: "AVG HR", value: avgTxt },
            { label: "MAX HR", value: maxTxt },
          ].map((t) => (
            <div
              key={t.label}
              className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
            >
              <div className="text-[10px] opacity-70">{safeText(t.label)}</div>
              <div className="text-xl font-semibold tabular-nums">
                {safeText(t.value)}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {item.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(item.notes)}</div>
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
          <div className="opacity-70 text-sm">
            HR stream nie je k dispozícii.
          </div>
        )}
      </div>

      {!!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((sp: any, idx: number) => (
              <li key={sp.split_index ?? idx}>
                Split {sp.split_index ?? idx}: {formatDistance(sp.distance_m)},{" "}
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
                Lap {lap.lap_index ?? idx}: {formatDistance(lap.distance_m)},{" "}
                {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {variant === "calendar" && showPlanDebug && (
        <details className="mt-4">
          <summary className="text-xs opacity-70 cursor-pointer">
            Debug JSON
          </summary>
          <pre className="mt-2 text-[11px] opacity-90 whitespace-pre-wrap break-words">
            {safeText((item as any).raw ?? item)}
          </pre>
        </details>
      )}
    </div>
  );
}