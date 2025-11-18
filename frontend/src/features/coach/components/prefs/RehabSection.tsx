// src/features/coach/components/RehabSection.tsx
"use client";

import TextField from "@/shared/components/ui/TextField";
import { SECTION } from "@/shared/ui/classes";
import type { RehabFocus } from "@/features/coach/types/prefsTypes";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function RehabSection({ local, setPref }: Props) {
  const rf = (local.rehab_focus ?? {}) as RehabFocus;

  return (
    <section className={SECTION}>
      <div className="text-sm font-medium opacity-90 mb-2">Rehab & recovery</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!rf.stretching}
            onChange={(e) =>
              setPref("rehab_focus", {
                stretching: e.target.checked,
                mobility: !!rf.mobility,
                balance: !!rf.balance,
                recovery_protocol: rf.recovery_protocol ?? null,
              } as RehabFocus)
            }
          />
          Stretching
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!rf.mobility}
            onChange={(e) =>
              setPref("rehab_focus", {
                stretching: !!rf.stretching,
                mobility: e.target.checked,
                balance: !!rf.balance,
                recovery_protocol: rf.recovery_protocol ?? null,
              } as RehabFocus)
            }
          />
          Mobility
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!rf.balance}
            onChange={(e) =>
              setPref("rehab_focus", {
                stretching: !!rf.stretching,
                mobility: !!rf.mobility,
                balance: e.target.checked,
                recovery_protocol: rf.recovery_protocol ?? null,
              } as RehabFocus)
            }
          />
          Balance/Proprioception
        </label>
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