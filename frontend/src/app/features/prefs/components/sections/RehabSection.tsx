// src/features/coach/components/RehabSection.tsx
"use client";

import * as React from "react";

import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import InputsCard from "@/app/shared/ui/components/InputsCard";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

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
    });

  const toggle = (key: keyof RehabFocus) =>
    key !== "recovery_protocol" &&
    setRehab({ [key]: !Boolean((rf as any)[key]) });

  const preview = `Focuses: ${
    (rf.stretching ? 1 : 0) +
    (rf.mobility ? 1 : 0) +
    (rf.balance ? 1 : 0)
  } · Protocol: ${rf.recovery_protocol ? "set" : "—"}`;

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Rehab & recovery</span>
          <TooltipIcon
            text={
              "Rehab focusy ovplyvňujú kompenzácie a regeneračné tréningy.\n\n" +
              "Protocol key je voľný identifikátor pre špeciálne šablóny."
            }
          />
        </div>
      }
      subtitle="Vyber rehab focusy a voliteľný ‘protocol key’."
      preview={preview}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="flex items-center gap-2 text-xs opacity-80">
          <span>Focus</span>
          <TooltipIcon text="Vyber oblasti, na ktoré sa má coach viac sústrediť." />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="prefs"
            active={!!rf.stretching}
            onClick={() => toggle("stretching")}
          >
            Stretching
          </Button>

          <Button
            size="xs"
            variant="prefs"
            active={!!rf.mobility}
            onClick={() => toggle("mobility")}
          >
            Mobility
          </Button>

          <Button
            size="xs"
            variant="prefs"
            active={!!rf.balance}
            onClick={() => toggle("balance")}
          >
            Balance / Proprioception
          </Button>
        </div>

        <TextField
          label={
            <span className="flex items-center gap-2">
              Protocol key (optional)
              <TooltipIcon text="Interný identifikátor – napr. návrat po zranení." />
            </span>
          }
          placeholder="e.g. return-to-run v2"
          value={rf.recovery_protocol ?? ""}
          onChange={(e) =>
            setRehab({
              recovery_protocol:
                (e.target as HTMLInputElement).value || null,
            })
          }
        />
      </div>
    </InputsCard>
  );
}