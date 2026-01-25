// src/features/coach/components/RehabSection.tsx
"use client";

import * as React from "react";

import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import InputsCard from "@/app/shared/components/ui/InputsCard";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import type { RehabFocus } from "@/app/features/prefs/types/prefs";

import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function RehabSection({ local, setPref }: Props) {
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
    if (key === "recovery_protocol") return;
    setRehab({ [key]: !Boolean((rf as any)[key]) } as Partial<RehabFocus>);
  };

  const selectedCount =
    (rf.stretching ? 1 : 0) + (rf.mobility ? 1 : 0) + (rf.balance ? 1 : 0);

  const preview = `Focuses: ${selectedCount} · Protocol: ${
    rf.recovery_protocol ? "set" : "—"
  }`;

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Rehab & recovery</span>
          <InfoPopover text="Select rehab focuses; protocol key is optional and can drive templates." />
        </div>
      }
      subtitle="Vyber rehab focusy a voliteľný ‘protocol key’ pre šablóny."
      preview={preview}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Focus pills */}
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-80">Focus</div>
          <InfoPopover text="Pick any rehab focuses to bias plans." />
        </div>

        <div className="flex flex-wrap gap-2">
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
      </div>
    </InputsCard>
  );
}