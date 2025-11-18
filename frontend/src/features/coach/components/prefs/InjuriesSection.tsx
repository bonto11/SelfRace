"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
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
  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "bolesť nártov po dlhých behoch",
  });

  const list = (local.injuries ?? []) as Injury[];

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Injuries / limitations
        </div>
        <InfoPopover text="Planner reduces risky elements and adds compensations." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <SelectField
          label="Area"
          value={injDraft.area}
          onChange={(e) =>
            setInjDraft((d) => ({ ...d, area: e.target.value as InjuryArea }))
          }
          options={INJ_AREAS.map((a) => ({ value: a, label: a }))}
        />
        <SelectField
          label="Type"
          value={injDraft.type}
          onChange={(e) =>
            setInjDraft((d) => ({ ...d, type: e.target.value as InjuryType }))
          }
          options={INJ_TYPES.map((t) => ({ value: t, label: t }))}
        />
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
                onClick={() =>
                  setLocal((p: any) => ({
                    ...p,
                    injuries: (p.injuries ?? []).filter(
                      (_: any, i: number) => i !== idx
                    ),
                  }))
                }
              >
                remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}