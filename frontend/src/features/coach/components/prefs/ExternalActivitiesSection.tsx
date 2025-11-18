"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import type {
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
} from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/shared/types/day";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXT_SPORTS: ExternalSport[] = ["football", "run", "ride", "strength", "other"];
const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
};

export function ExternalActivitiesSection({ local, setLocal }: Props) {
  const [extDraft, setExtDraft] = useState<ExternalActivity>({
    day: "Tue",
    sport: "football",
    intensity: "high",
    note: "",
  });

  const list = (local.external_activities ?? []) as ExternalActivity[];

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          External activities (non-coach)
        </div>
        <InfoPopover text="Other sports like football; planner accounts for them." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <SelectField
          label="Day"
          value={extDraft.day}
          onChange={(e) =>
            setExtDraft((d) => ({ ...d, day: e.target.value as DayAbbrev }))
          }
          options={ALL_DAYS.map((d) => ({ value: d, label: d }))}
        />
        <SelectField
          label="Sport"
          value={extDraft.sport}
          onChange={(e) =>
            setExtDraft((d) => ({
              ...d,
              sport: e.target.value as ExternalSport,
            }))
          }
          options={EXT_SPORTS.map((s) => ({ value: s, label: s }))}
        />
        <SelectField
          label="Intensity"
          value={extDraft.intensity}
          onChange={(e) =>
            setExtDraft((d) => ({
              ...d,
              intensity: e.target.value as ExternalIntensity,
            }))
          }
          options={EXT_INTENS.map((i) => ({ value: i, label: i }))}
        />
        <TextField
          label="Note"
          placeholder="optional"
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
            const arr = list.concat([
              { ...extDraft, note: extDraft.note?.trim() || undefined },
            ]);
            setLocal((p: any) => ({ ...p, external_activities: arr }));
          }}
          size="sm"
          variant="success"
        >
          Add external
        </Button>
      </div>

      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((a, idx) => (
            <li
              key={`${a.day}-${a.sport}-${idx}`}
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
                onClick={() =>
                  setLocal((p: any) => ({
                    ...p,
                    external_activities: (p.external_activities ?? []).filter(
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