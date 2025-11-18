// src/features/coach/components/RehabSection.tsx
"use client";

import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import { SECTION } from "@/shared/ui/classes";
import type { RehabFocus } from "@/features/coach/types/prefsTypes";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function RehabSection({ local, setPref }: Props) {
  const rf = (local.rehab_focus ?? {}) as RehabFocus;

  const toggle = (key: keyof RehabFocus) => {
    // bezpečný toggle s ponechaním ostatných hodnôt
    setPref("rehab_focus", {
      stretching: !!rf.stretching,
      mobility: !!rf.mobility,
      balance: !!rf.balance,
      recovery_protocol: rf.recovery_protocol ?? null,
      [key]: !Boolean(rf[key as keyof RehabFocus]),
    } as RehabFocus);
  };

  return (
    <section className={SECTION}>
      <div className="text-sm font-medium opacity-90 mb-2">Rehab & recovery</div>

      {/* multi-select pilule */}
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

      {/* protokol zostáva textové pole */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <TextField
          label="Protocol key (optional)"
          placeholder="e.g., return-to-run v2"
          value={rf.recovery_protocol ?? ""}
          onChange={(e) =>
            setPref("rehab_focus", {
              stretching: !!rf.stretching,
              mobility: !!rf.mobility,
              balance: !!rf.balance,
              recovery_protocol: (e.target as HTMLInputElement).value || null,
            } as RehabFocus)
          }
        />
      </div>
    </section>
  );
}