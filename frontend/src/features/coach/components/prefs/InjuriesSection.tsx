// src/features/coach/components/InjuriesSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import type {
  Injury,
  InjuryArea,
  InjuryType,
} from "@/features/coach/types/prefsTypes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

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

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
};

export function InjuriesSection({ local, setLocal }: Props) {
  const [open, setOpen] = useState(false);

  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "bolesť nártov po dlhých behoch",
  });

  const list = (local.injuries ?? []) as Injury[];

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Injuries / limitations</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Planner reduces risky elements and adds compensations." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse injuries"
            labelWhenClosed="Expand injuries"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70 select-none"].join(" ")}>
          {list.length
            ? `${list.length} entr${list.length === 1 ? "y" : "ies"}`
            : "No injuries recorded"}
        </div>
      )}

      {/* Body */}
      {open && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {/* Area select + quick pills */}
            <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
              <SelectField
                label="Area"
                value={injDraft.area}
                onChange={(e) =>
                  setInjDraft((d) => ({ ...d, area: e.target.value as InjuryArea }))
                }
                options={INJ_AREAS.map((a) => ({ value: a, label: a }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {INJ_AREAS.map((a) => {
                  const active = injDraft.area === a;
                  return (
                    <Button
                      key={a}
                      type="button"
                      size="xs"
                      variant="prefs"
                      active={active}
                      onClick={() => setInjDraft((d) => ({ ...d, area: a }))}
                    >
                      {a}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Type select + quick pills */}
            <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
              <SelectField
                label="Type"
                value={injDraft.type}
                onChange={(e) =>
                  setInjDraft((d) => ({ ...d, type: e.target.value as InjuryType }))
                }
                options={INJ_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {INJ_TYPES.map((t) => {
                  const active = injDraft.type === t;
                  return (
                    <Button
                      key={t}
                      type="button"
                      size="xs"
                      variant="prefs"
                      active={active}
                      onClick={() => setInjDraft((d) => ({ ...d, type: t }))}
                    >
                      {t}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <TextField
              label="Note"
              placeholder="e.g., foot pain…"
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
              size="sm"
              variant="success"
              onClick={() =>
                setLocal((p: any) => ({
                  ...p,
                  injuries: [
                    ...(p.injuries ?? []),
                    { ...injDraft, note: injDraft.note?.trim() || undefined },
                  ],
                }))
              }
            >
              Add injury
            </Button>
          </div>

          {list.length > 0 && (
            <ul className="mt-3 space-y-2">
              {list.map((it, idx) => (
                <li
                  key={`${it.area}-${it.type}-${idx}`}
                  className={[SURFACE_INLINE, "px-3 py-2 flex items-center justify-between"].join(
                    " "
                  )}
                >
                  <span className="text-sm">
                    {it.area} · {it.type}
                    {it.note ? ` — ${it.note}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      setLocal((p: any) => ({
                        ...p,
                        injuries: (p.injuries ?? []).filter((_: any, i: number) => i !== idx),
                      }))
                    }
                  >
                    remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}