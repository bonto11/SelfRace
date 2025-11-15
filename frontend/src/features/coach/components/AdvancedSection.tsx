"use client";

import { useState } from "react";
import TextField from "@/shared/components/ui/TextField";
import Button from "@/shared/components/ui/Button";
import {
  SECTION,
  SURFACE_INLINE,
  PILL_BUTTON,
} from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";
import type {
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
  Injury,
  InjuryArea,
  InjuryType,
  RehabFocus,
} from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/shared/types/day";
import { InfoPopover } from "./InfoPopover";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXT_SPORTS: ExternalSport[] = [
  "football",
  "run",
  "ride",
  "strength",
  "other",
];
const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];
const INJ_AREAS: InjuryArea[] = [
  "foot",
  "ankle",
  "shin",
  "knee",
  "hip",
  "hamstring",
  "calf",
  "back",
  "shoulder",
  "other",
];
const INJ_TYPES: InjuryType[] = [
  "overuse",
  "acute",
  "tendon",
  "stress",
  "shin_splints",
  "plantar",
  "itb",
  "other",
];

const FOCUS_CHOICES = [
  "ankle_strength",
  "foot_intrinsics",
  "calf_strength",
  "hamstrings",
  "glutes",
  "core_stability",
  "thoracic_mobility",
  "shoulder_stability",
] as const;

const AVOID_CHOICES = [
  "impact_high",
  "downhill_runs",
  "hard_surfaces",
  "back_to_back_speed",
] as const;

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  setPref: (key: any, value: any) => void;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
};

export function AdvancedSection({
  local,
  setLocal,
  setPref,
  toggleInArray,
}: Props) {
  const [extDraft, setExtDraft] = useState<ExternalActivity>({
    day: "Tue",
    sport: "football",
    intensity: "high",
    note: "",
  });

  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "bolesť nártov po dlhých behoch",
  });

  return (
    <>
      {/* MODELS & BLOCKS */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            Intensity models & specific blocks
          </div>
          <InfoPopover text="Polarized/Pyramidal shape; VO₂max/FTP blocks." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).vo2max_training}
              onChange={(e) =>
                setPref("vo2max_training" as any, e.target.checked as any)
              }
            />
            Include VO₂max blocks (run)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).ftp_training}
              onChange={(e) =>
                setPref("ftp_training" as any, e.target.checked as any)
              }
            />
            Include FTP blocks (ride)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).threshold_focus}
              onChange={(e) =>
                setPref("threshold_focus" as any, e.target.checked as any)
              }
            />
            Threshold focus (more Z3/Z4)
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={[
              PILL_BUTTON,
              (local as any).polarized_model ? ACTIVE_PILL : "border-white/15",
            ].join(" ")}
            onClick={() => setPref("polarized_model" as any, true as any)}
          >
            Polarized (80/20)
          </button>
          <button
            className={[
              PILL_BUTTON,
              (local as any).pyramidal_model ? ACTIVE_PILL : "border-white/15",
            ].join(" ")}
            onClick={() => setPref("pyramidal_model" as any, true as any)}
          >
            Pyramidal
          </button>
          <button
            className={PILL_BUTTON}
            onClick={() =>
              setLocal(
                (p) =>
                  ({
                    ...p,
                    polarized_model: false,
                    pyramidal_model: false,
                  } as any)
              )
            }
          >
            Clear model
          </button>
        </div>
      </section>

      {/* EXTERNAL ACTIVITIES */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            External activities (non-coach)
          </div>
          <InfoPopover text="Other sports like football; planner accounts for them." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className={inputClass}
            value={extDraft.day}
            onChange={(e) =>
              setExtDraft((d) => ({
                ...d,
                day: e.target.value as DayAbbrev,
              }))
            }
          >
            {ALL_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={extDraft.sport}
            onChange={(e) =>
              setExtDraft((d) => ({
                ...d,
                sport: e.target.value as ExternalSport,
              }))
            }
          >
            {EXT_SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={extDraft.intensity}
            onChange={(e) =>
              setExtDraft((d) => ({
                ...d,
                intensity: e.target.value as ExternalIntensity,
              }))
            }
          >
            {EXT_INTENS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <TextField
            placeholder="note (optional)"
            value={extDraft.note ?? ""}
            onChange={(e) =>
              setExtDraft((d) => ({
                ...d,
                note: (e.target as HTMLInputElement).value,
              }))
            }
          />
        </div>
        <div className="mt-2">
          <Button
            onClick={() => {
              const cur = (local as any).external_activities ?? [];
              setLocal(
                (p) =>
                  ({
                    ...p,
                    external_activities: [
                      ...cur,
                      {
                        ...extDraft,
                        note: extDraft.note?.trim() || undefined,
                      },
                    ],
                  } as any)
              );
            }}
            size="sm"
            variant="success"
          >
            Add external
          </Button>
        </div>

        {((local as any).external_activities ?? []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {((local as any).external_activities ?? []).map(
              (a: any, idx: number) => (
                <li
                  key={idx}
                  className={[
                    SURFACE_INLINE,
                    "px-3 py-2 flex items-center justify-between",
                  ].join(" ")}
                >
                  <span className="text-sm">
                    {a.day} · {a.sport} · {a.intensity}
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const cur = (local as any).external_activities ?? [];
                      setLocal(
                        (p) =>
                          ({
                            ...p,
                            external_activities: cur.filter(
                              (_: any, i: number) => i !== idx
                            ),
                          } as any)
                      );
                    }}
                  >
                    remove
                  </Button>
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {/* INJURIES */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            Injuries / limitations
          </div>
          <InfoPopover text="Planner reduces risky elements and adds compensations." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className={inputClass}
            value={injDraft.area}
            onChange={(e) =>
              setInjDraft((d) => ({
                ...d,
                area: e.target.value as InjuryArea,
              }))
            }
          >
            {INJ_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={injDraft.type}
            onChange={(e) =>
              setInjDraft((d) => ({
                ...d,
                type: e.target.value as InjuryType,
              }))
            }
          >
            {INJ_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <TextField
            placeholder="note (e.g., foot pain…)"
            value={injDraft.note ?? ""}
            onChange={(e) =>
              setInjDraft((d) => ({
                ...d,
                note: (e.target as HTMLInputElement).value,
              }))
            }
            containerClassName="md:col-span-2"
          />
        </div>
        <div className="mt-2">
          <Button
            onClick={() => {
              const cur = (local as any).injuries ?? [];
              setLocal(
                (p) =>
                  ({
                    ...p,
                    injuries: [
                      ...cur,
                      {
                        ...injDraft,
                        note: injDraft.note?.trim() || undefined,
                      },
                    ],
                  } as any)
              );
            }}
            size="sm"
            variant="success"
          >
            Add injury
          </Button>
        </div>

        {((local as any).injuries ?? []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {((local as any).injuries ?? []).map((it: any, idx: number) => (
              <li
                key={idx}
                className={[
                  SURFACE_INLINE,
                  "px-3 py-2 flex items-center justify-between",
                ].join(" ")}
              >
                <span className="text-sm">
                  {it.area} · {it.type}
                  {it.note ? ` — ${it.note}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const cur = (local as any).injuries ?? [];
                    setLocal(
                      (p) =>
                        ({
                          ...p,
                          injuries: cur.filter(
                            (_: any, i: number) => i !== idx
                          ),
                        } as any)
                    );
                  }}
                >
                  remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FOCUS & AVOID */}
      <section className={SECTION}>
        <div className="text-xs opacity-80 mb-1">Focus areas</div>
        <div className="flex flex-wrap gap-2">
          {FOCUS_CHOICES.map((k) => {
            const cur = (local as any).focus_areas as string[] | undefined;
            const active = !!cur?.includes(k);
            const next = toggleInArray(cur, k);
            return (
              <button
                key={k}
                onClick={() => {
                  setPref("focus_areas" as any, next as any);
                }}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15",
                ].join(" ")}
              >
                {k}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-xs opacity-80 mb-1">Avoid</div>
        <div className="flex flex-wrap gap-2">
          {AVOID_CHOICES.map((k) => {
            const cur = (local as any).avoid_zones as string[] | undefined;
            const active = !!cur?.includes(k);
            const next = toggleInArray(cur, k);
            return (
              <button
                key={k}
                onClick={() => {
                  setPref("avoid_zones" as any, next as any);
                }}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15",
                ].join(" ")}
              >
                {k}
              </button>
            );
          })}
        </div>
      </section>

      {/* REHAB */}
      <section className={SECTION}>
        <div className="text-sm font-medium opacity-90 mb-2">
          Rehab & recovery
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).rehab_focus?.stretching}
              onChange={(e) =>
                setPref(
                  "rehab_focus" as any,
                  {
                    stretching: e.target.checked,
                    mobility: !!(local as any).rehab_focus?.mobility,
                    balance: !!(local as any).rehab_focus?.balance,
                    recovery_protocol:
                      (local as any).rehab_focus?.recovery_protocol ?? null,
                  } as RehabFocus
                )
              }
            />
            Stretching
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).rehab_focus?.mobility}
              onChange={(e) =>
                setPref(
                  "rehab_focus" as any,
                  {
                    stretching: !!(local as any).rehab_focus?.stretching,
                    mobility: e.target.checked,
                    balance: !!(local as any).rehab_focus?.balance,
                    recovery_protocol:
                      (local as any).rehab_focus?.recovery_protocol ?? null,
                  } as RehabFocus
                )
              }
            />
            Mobility
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!(local as any).rehab_focus?.balance}
              onChange={(e) =>
                setPref(
                  "rehab_focus" as any,
                  {
                    stretching: !!(local as any).rehab_focus?.stretching,
                    mobility: !!(local as any).rehab_focus?.mobility,
                    balance: e.target.checked,
                    recovery_protocol:
                      (local as any).rehab_focus?.recovery_protocol ?? null,
                  } as RehabFocus
                )
              }
            />
            Balance/Proprioception
          </label>
          <TextField
            placeholder="protocol key (optional)"
            value={(local as any).rehab_focus?.recovery_protocol ?? ""}
            onChange={(e) =>
              setPref(
                "rehab_focus" as any,
                {
                  stretching: !!(local as any).rehab_focus?.stretching,
                  mobility: !!(local as any).rehab_focus?.mobility,
                  balance: !!(local as any).rehab_focus?.balance,
                  recovery_protocol:
                    (e.target as HTMLInputElement).value || null,
                } as RehabFocus
              )
            }
          />
        </div>
      </section>
    </>
  );
}