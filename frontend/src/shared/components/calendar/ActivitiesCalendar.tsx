// src/shared/components/calendar/ActivitiesCalendar.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import {
  CALENDAR_CONTAINER,
  CALENDAR_DAY_CELL,
  NO_X_OVERFLOW,
  CARD,
} from "@/shared/ui/classes";
import ActivitySelector from "@/shared/components/ActivitySelector";
import PlanSingle, { PlanStatus } from "@/shared/components/PlanSingle";
import { savePlanActivityLink } from "@/features/coach/api/plan";

const ActivityTable = dynamic(
  () => import("@/shared/components/ActivityTable"),
  { ssr: false }
);

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

type DayCellData = {
  iso: string;
  inMonth: boolean;
  day: number | null;
  activities: {
    id: number;
    sport: string;
    name: string;
  }[];
  plans: {
    id: number;
    sport: string;
    status: PlanStatus;
  }[];
};

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
// Po = 0
const startWeekday = (y: number, m0: number) =>
  (new Date(y, m0, 1).getDay() + 6) % 7;

/* ───────── helpers pre plán ───────── */

type AnyObj = Record<string, any>;

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (
    Array.isArray(hr) &&
    hr.length === 2 &&
    hr.every((x) => Number.isFinite(x))
  ) {
    return `HR ${hr[0]}–${hr[1]}`;
  }
  return null;
}
function paceToText(p?: any): string | null {
  return typeof p === "string" && p.trim() ? `pace ${p}` : null;
}
function powerToText(w?: any): string | null {
  return Number.isFinite(w) ? `power ${w}W` : null;
}

function normTarget(it: AnyObj): string | null {
  const hr = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow = it?.target_power_watts ?? null;

  const mainT = Array.isArray(it?.structure?.main)
    ? it.structure.main[0]?.target
    : it?.structure?.main?.target;

  const hr2 = hr ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2 = pow ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(
    Boolean
  );
  return parts.length ? parts.join(" · ") : null;
}

function intervalsToText(main: any): string | null {
  const arr = Array.isArray(main)
    ? main
    : main && Array.isArray(main.sets)
    ? main.sets
    : null;
  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec =
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [
        hrToText(first.target.hr),
        paceToText(first.target.pace),
        powerToText(first.target.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean)
    .join(" ");
  return txt || null;
}

function normTitle(it: AnyObj) {
  return it?.title ?? it?.name ?? "Session";
}
function normDuration(it: AnyObj) {
  const minutes =
    (typeof it?.duration_min === "number" && it.duration_min) ??
    (typeof it?.dur === "number" && it.dur) ??
    null;
  return minutes != null ? `${minutes} min` : null;
}
function normIntensity(it: AnyObj) {
  return it?.intensity ?? null;
}

function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;

  const wu = it?.structure?.warmup
    ? [
        it.structure.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : null,
        hrToText(it.structure.warmup?.target?.hr),
        paceToText(it.structure.warmup?.target?.pace),
        powerToText(it.structure.warmup?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const main = it?.structure?.main ? intervalsToText(it.structure.main) : "";

  const cd = it?.structure?.cooldown
    ? [
        it.structure.cooldown?.notes
          ? `CD: ${it.structure.cooldown.notes}`
          : null,
        hrToText(it.structure.cooldown?.target?.hr),
        paceToText(it.structure.cooldown?.target?.pace),
        powerToText(it.structure.cooldown?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const ex =
    Array.isArray(it?.exercises) && it.exercises.length
      ? "Exercises: " +
        it.exercises
          .map((e: any) => {
            const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
            if (e?.seconds) parts.push(`${e.seconds}s`);
            else if (e?.reps) parts.push(`${e.reps}`);
            return parts.filter(Boolean).join(" ");
          })
          .join(", ")
      : "";

  const parts = [wu, main, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

/* reálna dĺžka v minútach */

function fmtRealDurationMin(seconds?: number | null): string | null {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function isRestSession(row: any, sess: AnyObj): boolean {
  const sport = (row as any).sport || detectSport(sess) || "other";
  const duration = sess.duration_min ?? row.duration_min ?? null;
  const title = String(
    sess.title || sess.session_type || row.title || row.session_type || ""
  );

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

/* ───────── mapovanie dát na grid ───────── */

function useMonthData(year: number, month0: number) {
  const { rows: actRows } = useActivityData();
  const { rows: planRows } = usePlanData();
  const [map, setMap] = React.useState<Record<string, DayCellData>>({});

  React.useEffect(() => {
    const totalCells = 42;
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    const grid: Record<string, DayCellData> = {};

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      const inMonth = d.getMonth() === month0;
      grid[k] = {
        iso: k,
        inMonth,
        day: inMonth ? d.getDate() : null,
        activities: [],
        plans: [],
      };
    }

    const firstIso = iso(year, month0, 1);
    const lastIso = iso(year, month0, daysInMonth(year, month0));
    const todayIso = new Date().toISOString().slice(0, 10);

    // plánované session
    for (const p of planRows) {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;

      const sess: AnyObj = (p as any).payload ?? p;
      if (isRestSession(p, sess)) continue;

      const sport = (p as any).sport || detectSport(sess) || "other";

      const actIdRaw = (p as any).activity_id;
      const actId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw))
          ? Number(actIdRaw)
          : null;

      let status: PlanStatus = "planned";
      if (actId) {
        status = "done";
      } else if (dIso < todayIso) {
        status = "missed";
      }

      const cell = grid[dIso];
      if (!cell) continue;
      cell.plans.push({ id: p.id, sport, status });
    }

    // reálne aktivity
    for (const r of actRows) {
      const dIso = r.date.slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const cell = grid[dIso];
      if (!cell) continue;

      const aid = Number(r.activity_id);
      const sport = (r as any).sport || (r as any).sport_type_fe || "other";

      cell.activities.push({
        id: aid,
        sport,
        name: r.name || "",
      });
    }

    setMap(grid);
  }, [actRows, planRows, year, month0]);

  return map;
}

/* ───────── Day cell ───────── */
function DayCell({
  cell,
  onSelect,
  isSelected,
}: {
  cell: DayCellData;
  onSelect: (iso: string) => void;
  isSelected: boolean;
}) {
  const muted = cell.inMonth ? "" : "opacity-40";

  type DotKind = "activity" | "plan" | "done" | "missed";

  type Dot = {
    key: string;
    sport: string;
    kind: DotKind;
  };

  const dots: Dot[] = [];

  // 1) reálne aktivity – plná farebná bodka
  for (const it of cell.activities) {
    dots.push({
      key: `a-${it.id}`,
      sport: it.sport,
      kind: "activity",
    });
  }

  // 2) tréningy z plánu – podľa statusu
  for (const it of cell.plans) {
    const kind: DotKind =
      it.status === "planned"
        ? "plan"
        : it.status === "done"
        ? "done"
        : "missed";

    dots.push({
      key: `p-${it.id}`,
      sport: it.sport,
      kind,
    });
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.iso)}
      className={[
        "px-2 py-1.5 text-left w-full focus:outline-none",
        CALENDAR_DAY_CELL,
        "min-h-[56px]",
        isSelected ? "ring-2 ring-emerald-500/60" : "",
        "hover:bg-white/10",
        muted,
      ].join(" ")}
      aria-pressed={isSelected}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5 select-none">
          {cell.day ?? ""}
        </span>

        <div className="mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
          {dots.slice(0, 8).map((it) => {
            const color = SPORT_COLORS[it.sport] ?? SPORT_COLORS.other;

            if (it.kind === "activity") {
              // plná bodka – reálna aktivita
              return (
                <span
                  key={it.key}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              );
            }

            if (it.kind === "plan") {
              // prázdny kruh – plán
              return (
                <span
                  key={it.key}
                  className="inline-block w-1.5 h-1.5 rounded-full border"
                  style={{ borderColor: color, backgroundColor: "transparent" }}
                />
              );
            }

            if (it.kind === "done") {
              // farebná fajka – splnený tréning
              return (
                <span
                  key={it.key}
                  className="text-[11px] leading-none"
                  style={{ color }}
                >
                  ✓
                </span>
              );
            }

            // kind === "missed" → farebné X
            return (
              <span
                key={it.key}
                className="text-[11px] leading-none"
                style={{ color }}
              >
                ×
              </span>
            );
          })}

          {dots.length > 8 && (
            <span className="text-[10px] opacity-70">+{dots.length - 8}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ───────── hlavný komponent ───────── */

export default function ActivitiesCalendar({
  year: yy,
  month: mm,
}: {
  year?: number;
  month?: number;
}) {
  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);
  const [focusedActivityId, setFocusedActivityId] = React.useState<
    number | null
  >(null);
  const [draftLinks, setDraftLinks] = React.useState<
    Record<number, number | null>
  >({});
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const { rows: planRows } = usePlanData();
  const { rows: actRows } = useActivityData();

  const inferredUserId: number | null =
    (planRows[0] as any)?.user_id ?? (actRows[0] as any)?.user_id ?? null;

  const todayIso = new Date().toISOString().slice(0, 10);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIso(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    setFocusedActivityId(null);
  }, [selectedIso]);

  const map = useMonthData(year, month0);

  const cells = React.useMemo(() => {
    const out: DayCellData[] = [];
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      out.push(
        map[k] ?? {
          iso: k,
          inMonth: d.getMonth() === month0,
          day: d.getMonth() === month0 ? d.getDate() : null,
          activities: [],
          plans: [],
        }
      );
    }
    return out;
  }, [map, year, month0]);

  const jump = (dir: -1 | 1) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + dir);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  const label = new Date(year, month0, 1).toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  // plánované sessions pre vybraný deň (bez REST)
  const selectedPlanRows = React.useMemo(() => {
    if (!selectedIso) return [];
    return planRows.filter((p: any) => {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso !== selectedIso) return false;
      const sess: AnyObj = p.payload ?? p;
      return !isRestSession(p, sess);
    });
  }, [planRows, selectedIso]);

  const selectedDonePlans = React.useMemo(
    () =>
      selectedPlanRows.filter(
        (p: any) =>
          p.activity_id != null && !Number.isNaN(Number(p.activity_id))
      ),
    [selectedPlanRows]
  );

  const selectedPlans = React.useMemo(
    () =>
      selectedPlanRows.filter(
        (p: any) => p.activity_id == null || Number.isNaN(Number(p.activity_id))
      ),
    [selectedPlanRows]
  );

  const selectedLabel = React.useMemo(() => {
    if (!selectedIso) return "";
    const d = new Date(selectedIso);
    return d.toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [selectedIso]);

  const actMap = React.useMemo(() => {
    const m = new Map<number, any>();
    for (const r of actRows) {
      const id = Number((r as any).activity_id);
      if (!Number.isNaN(id)) m.set(id, r);
    }
    return m;
  }, [actRows]);

  async function handleSaveLink(sessionId: number) {
    if (!inferredUserId) {
      console.warn("[ActivitiesCalendar] missing userId, cannot save link");
      return;
    }
    const draft = draftLinks[sessionId];
    const activityId = draft == null ? null : Number(draft);

    setSavingId(sessionId);
    try {
      const res = await savePlanActivityLink(
        inferredUserId,
        sessionId,
        activityId
      );
      console.log("[ActivitiesCalendar] savePlanActivityLink result", res);
      // prípadný refetch/invalidácia si vieš doplniť neskôr
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
      {/* HLAVIČKA + mriežka */}
      <div className={CALENDAR_CONTAINER}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kalendár aktivít</h2>
          <div className="flex items-center gap-2 translate-y-[2px]">
            <Button
              variant="ghost"
              size="sm"
              circle
              aria-label="Predchádzajúci mesiac"
              onClick={() => jump(-1)}
            >
              ‹
            </Button>
            <div className="mx-1 text-base font-semibold min-w-[160px] text-center">
              {label}
            </div>
            <Button
              variant="ghost"
              size="sm"
              circle
              aria-label="Nasledujúci mesiac"
              onClick={() => jump(1)}
            >
              ›
            </Button>
          </div>
        </div>

        {/* legenda */}
        <div className="mt-2 mb-1 flex flex-wrap gap-3 text-[11px] opacity-70">
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: THEME.chart.run }}
            />
            <span>aktivita</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full border"
              style={{
                borderColor: THEME.chart.run,
                backgroundColor: "transparent",
              }}
            />
            <span>plán</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] leading-none"
              style={{ color: THEME.chart.run }}
            >
              ✓
            </span>
            <span>splnený plán</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] leading-none"
              style={{ color: THEME.chart.run }}
            >
              ×
            </span>
            <span>missed plán</span>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70">
          {["p", "u", "s", "š", "p", "s", "n"].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((c) => (
            <DayCell
              key={c.iso}
              cell={c}
              isSelected={selectedIso === c.iso}
              onSelect={(isoVal) =>
                setSelectedIso((cur) => (cur === isoVal ? null : isoVal))
              }
            />
          ))}
        </div>
      </div>

      {/* DETAIL pod kalendárom */}
      {selectedIso && (
        <div className="mt-3 ml-1 space-y-3">
          {/* aktivity */}
          <ActivityTable
            start={selectedIso}
            end={selectedIso}
            variant="calendar"
            suppressItemHeaderIfSingleDay
            autoOpenActivityId={focusedActivityId ?? undefined}
          />

          {/* plán */}
          <div className={[CARD, "space-y-2", "p-3 md:p-4"].join(" ")}>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold">
                Plán & stav tréningov — {selectedLabel}
              </h3>
            </div>

            {selectedPlanRows.length === 0 && (
              <p className="text-sm opacity-70">
                Pre tento deň nie je vytvorený žiadny plán.
              </p>
            )}

            {/* splnené */}
            {selectedDonePlans.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1 mt-1.5">
                  Splnené tréningy
                </div>
                <ul className="space-y-2">
                  {selectedDonePlans.map((p: any) => {
                    const sess: AnyObj = p.payload ?? p;
                    const sport =
                      (p as any).sport || detectSport(sess) || "other";

                    const sessionTypeId =
                      typeof sess?.session_type === "string"
                        ? sess.session_type
                        : typeof p.session_type === "string"
                        ? p.session_type
                        : null;

                    const trainingDef = sessionTypeId
                      ? findTrainingTypeById(sessionTypeId)
                      : null;

                    const title =
                      trainingDef?.label || normTitle(sess) || "Tréning";

                    const baseNotes = normNotes(sess);
                    const typeLine = trainingDef?.description || null;
                    const combinedNotes = [typeLine, baseNotes]
                      .filter(Boolean)
                      .join(" • ");

                    const actId =
                      p.activity_id != null ? Number(p.activity_id) : null;
                    const act =
                      actId != null && !Number.isNaN(actId)
                        ? actMap.get(actId)
                        : null;

                    const actDur = fmtRealDurationMin(
                      act?.moving_time_s ?? act?.moving_time
                    );
                    const distStr =
                      act?.distance_m != null
                        ? `${(act.distance_m / 1000).toFixed(2)} km`
                        : null;

                    const activitySummary =
                      actId != null && !Number.isNaN(actId)
                        ? [act?.name || "Activity", distStr, actDur]
                            .filter(Boolean)
                            .join(" · ")
                        : null;

                    const hasDraft = Object.prototype.hasOwnProperty.call(
                      draftLinks,
                      p.id
                    );
                    const baseVal =
                      actId != null && !Number.isNaN(actId) ? actId : null;
                    const currentDraft = hasDraft ? draftLinks[p.id] : baseVal;

                    const handleOpenActivity = () => {
                      if (actId != null && !Number.isNaN(actId)) {
                        setFocusedActivityId(actId);
                      }
                    };

                    return (
                      <li key={`done-${p.id}`} className="px-0">
                        <PlanSingle
                          id={p.id}
                          title={title}
                          dateIso={String(p.plan_date).slice(0, 10)}
                          sport={sport}
                          status="done"
                          planDur={normDuration(sess)}
                          planIntensity={normIntensity(sess)}
                          planTarget={normTarget(sess)}
                          planNotes={combinedNotes || null}
                          activitySummary={activitySummary}
                        >
                          <div className="text-xs flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={handleOpenActivity}
                              disabled={actId == null || Number.isNaN(actId)}
                            >
                              Otvoriť aktivitu
                            </Button>

                            <div className="flex flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
                              <span className="opacity-70">
                                Priradiť k aktivite:
                              </span>

                              <div className="flex-1 max-w-xs">
                                <ActivitySelector
                                  userId={inferredUserId}
                                  dateIso={selectedIso || ""}
                                  sports={[sport]}
                                  deltaDays={2}
                                  value={
                                    currentDraft == null ? "" : currentDraft
                                  }
                                  onChange={(id) => {
                                    setDraftLinks((prev) => ({
                                      ...prev,
                                      [p.id]: id === "" ? null : Number(id),
                                    }));
                                  }}
                                  variant="compact"
                                />
                              </div>

                              <Button
                                variant="primary"
                                size="xs"
                                disabled={!inferredUserId || savingId === p.id}
                                onClick={() => handleSaveLink(p.id)}
                              >
                                {savingId === p.id ? "Ukladám…" : "Uložiť"}
                              </Button>
                            </div>
                          </div>
                        </PlanSingle>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* plánované (bez aktivity / missed/planned) */}
            {selectedPlans.length > 0 && (
              <>
                <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1 mt-2">
                  Plánované tréningy
                </div>
                <ul className="space-y-2">
                  {selectedPlans.map((p: any) => {
                    const sess: AnyObj = p.payload ?? p;
                    const sport =
                      (p as any).sport || detectSport(sess) || "other";

                    const sessionTypeId =
                      typeof sess?.session_type === "string"
                        ? sess.session_type
                        : typeof p.session_type === "string"
                        ? p.session_type
                        : null;

                    const trainingDef = sessionTypeId
                      ? findTrainingTypeById(sessionTypeId)
                      : null;

                    const title =
                      trainingDef?.label || normTitle(sess) || "Tréning";

                    const baseNotes = normNotes(sess);
                    const typeLine = trainingDef?.description || null;
                    const combinedNotes = [typeLine, baseNotes]
                      .filter(Boolean)
                      .join(" • ");

                    const dIso = String(p.plan_date).slice(0, 10);
                    const status: PlanStatus =
                      dIso < todayIso ? "missed" : "planned";

                    const hasDraft = Object.prototype.hasOwnProperty.call(
                      draftLinks,
                      p.id
                    );
                    const baseVal = null;
                    const currentDraft = hasDraft ? draftLinks[p.id] : baseVal;

                    return (
                      <li key={p.id} className="px-0">
                        <PlanSingle
                          id={p.id}
                          title={title}
                          dateIso={dIso}
                          sport={sport}
                          status={status}
                          planDur={normDuration(sess)}
                          planIntensity={normIntensity(sess)}
                          planTarget={normTarget(sess)}
                          planNotes={combinedNotes || null}
                          activitySummary={null}
                        >
                          <div className="text-xs flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                            <span className="opacity-70">
                              Priradiť k aktivite:
                            </span>

                            <div className="flex-1 max-w-xs">
                              <ActivitySelector
                                userId={inferredUserId}
                                dateIso={selectedIso || ""}
                                sports={[sport]}
                                deltaDays={2}
                                value={currentDraft == null ? "" : currentDraft}
                                onChange={(id) => {
                                  setDraftLinks((prev) => ({
                                    ...prev,
                                    [p.id]: id === "" ? null : Number(id),
                                  }));
                                }}
                                variant="compact"
                              />
                            </div>

                            <Button
                              variant="primary"
                              size="xs"
                              disabled={!inferredUserId || savingId === p.id}
                              onClick={() => handleSaveLink(p.id)}
                            >
                              {savingId === p.id ? "Ukladám…" : "Uložiť"}
                            </Button>
                          </div>
                        </PlanSingle>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
