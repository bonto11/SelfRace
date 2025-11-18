// src/features/coach/components/RehabSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import type { RehabFocus } from "@/features/coach/types/prefsTypes";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function RehabSection({ local, setPref }: Props) {
  const [open, setOpen] = useState(false);
  const rf = (local.rehab_focus ?? {}) as RehabFocus;

  const setRehab = (patch: Partial<RehabFocus>) =>
    setPref("rehab_focus", {
      stretching: !!rf.stretching,
      mobility: !!rf.mobility,
      balance: !!rf.balance,
      recovery_protocol: rf.recovery_protocol ?? null,
      ...patch,
    } as RehabFocus);

  const toggle = (key: keyof RehabFocus) => {
    // multi-select toggle (len boolean kľúče)
    if (key === "recovery_protocol") return;
    setRehab({ [key]: !Boolean(rf[key]) } as Partial<RehabFocus>);
  };

  const selectedCount =
    (rf.stretching ? 1 : 0) + (rf.mobility ? 1 : 0) + (rf.balance ? 1 : 0);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rehab & recovery</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Select rehab focuses; protocol key is optional and can drive templates." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Rehab"
            labelWhenClosed="Expand Rehab"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70 select-none"].join(" ")}>
          Focuses: {selectedCount} · Protocol: {rf.recovery_protocol ? "set" : "—"}
        </div>
      )}

      {/* Body */}
      {open && (
        <>
          {/* Focus pills */}
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs opacity-80">Focus</div>
            <InfoPopover text="Pick any rehab focuses to bias plans." />
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!rf.stretching}
              onClick={() => toggle("stretching")}
            >
              Stretching
            </Button>

            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!rf.mobility}
              onClick={() => toggle("mobility")}
            >
              Mobility
            </Button>

            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!rf.balance}
              onClick={() => toggle("balance")}
            >
              Balance / Proprioception
            </Button>
          </div>

          {/* Protocol field */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <TextField
              label="Protocol key (optional)"
              placeholder="e.g., return-to-run v2"
              value={rf.recovery_protocol ?? ""}
              onChange={(e) =>
                setRehab({
                  recovery_protocol: (e.target as HTMLInputElement).value || null,
                })
              }
            />
          </div>
        </>
      )}
    </section>
  );
}