// src/features/coach/components/ExternalActivitiesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
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

export function ExternalActivitiesSection({ local, setLocal }: { local: any; setLocal: (fn: (prev: any) => any) => void; }) {
  const [open, setOpen] = useState(false);

  const [extDraft, setExtDraft] = useState<ExternalActivity>({
    day: "Tue",
    sport: "football",
    intensity: "high",
    note: "",
  });

  const list = (local.external_activities ?? []) as ExternalActivity[];

  // sorted preview (Mon..Sun), stable by sport/intensity
  const preview = useMemo(() => {
    const order = Object.fromEntries(ALL_DAYS.map((d, i) => [d, i]));
    return [...list].sort((a, b) => {
      const d = (order[a.day] ?? 0) - (order[b.day] ?? 0);
      if (d !== 0) return d;
      const s = a.sport.localeCompare(b.sport);
      if (s !== 0) return s;
      return a.intensity.localeCompare(b.intensity);
    });
  }, [list]);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">External activities (non-coach)</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Other sports like football; planner accounts for them." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse external activities"
            labelWhenClosed="Expand external activities"
          />
        </div>
      </div>

      {/* Closed preview — compact list: Day · Sport · Intensity (no count) */}
      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs select-none"].join(" ")}>
          {preview.length === 0 ? (
            <span className="opacity-70">No external activities — click the arrow to add.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {preview.map((a, idx) => (
                <span
                  key={`${a.day}-${a.sport}-${a.intensity}-${idx}`}
                  className="px-1.5 py-0.5 rounded border border-white/15/50 bg-white/5 text-[10px] tracking-wide"
                  title={a.note ? a.note : `${a.day} · ${a.sport} · ${a.intensity}`}
                >
                  {a.day} · {a.sport} · {a.intensity}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {open && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <SelectField
              label="Day"
              value={extDraft.day}
              onChange={(e) => setExtDraft((d) => ({ ...d, day: e.target.value as DayAbbrev }))}
              options={ALL_DAYS.map((d) => ({ value: d, label: d }))}
            />

            <SelectField
              label="Sport"
              value={extDraft.sport}
              onChange={(e) => setExtDraft((d) => ({ ...d, sport: e.target.value as ExternalSport }))}
              options={EXT_SPORTS.map((s) => ({ value: s, label: s }))}
            />

            {/* Intensity select + quick pills */}
            <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
              <SelectField
                label="Intensity"
                value={extDraft.intensity}
                onChange={(e) => setExtDraft((d) => ({ ...d, intensity: e.target.value as ExternalIntensity }))}
                options={EXT_INTENS.map((i) => ({ value: i, label: i }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {EXT_INTENS.map((i) => (
                  <Button
                    key={i}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={extDraft.intensity === i}
                    onClick={() => setExtDraft((d) => ({ ...d, intensity: i }))}
                  >
                    {i}
                  </Button>
                ))}
              </div>
            </div>

            <TextField
              label="Note"
              placeholder="optional"
              value={extDraft.note ?? ""}
              onChange={(e) => setExtDraft((d) => ({ ...d, note: (e.target as HTMLInputElement).value }))}
            />
          </div>

          <div className="mt-2">
            <Button
              onClick={() => {
                const arr = list.concat([{ ...extDraft, note: extDraft.note?.trim() || undefined }]);
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
                  className={[SURFACE_INLINE, "px-3 py-2 flex items-center justify-between"].join(" ")}
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
                        external_activities: (p.external_activities ?? []).filter((_: any, i: number) => i !== idx),
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