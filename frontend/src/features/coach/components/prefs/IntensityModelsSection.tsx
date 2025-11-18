// src/features/coach/components/IntensityModelsSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  setPref: (key: any, value: any) => void;
};

export function IntensityModelsSection({ local, setLocal, setPref }: Props) {
  const [open, setOpen] = useState(false);

  const pol = !!local.polarized_model;
  const pyr = !!local.pyramidal_model;

  const vo2 = !!local.vo2max_training;
  const ftp = !!local.ftp_training;
  const thr = !!local.threshold_focus;

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Intensity models & specific blocks
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Polarized/Pyramidal shape; VO₂max/FTP blocks." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse intensity section"
            labelWhenClosed="Expand intensity section"
          />
        </div>
      </div>

      {open && (
        <div className="space-y-3">
          {/* Intensity models */}
          <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                Intensity models
              </div>
              <InfoPopover text="Select an overall intensity distribution for the plan." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={pol}
                onClick={() =>
                  setLocal((p: any) => ({
                    ...p,
                    polarized_model: !p.polarized_model,
                    pyramidal_model: false,
                  }))
                }
              >
                Polarized (80/20)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={pyr}
                onClick={() =>
                  setLocal((p: any) => ({
                    ...p,
                    pyramidal_model: !p.pyramidal_model,
                    polarized_model: false,
                  }))
                }
              >
                Pyramidal
              </Button>

              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() =>
                  setLocal((p: any) => ({
                    ...p,
                    polarized_model: false,
                    pyramidal_model: false,
                  }))
                }
              >
                Clear model
              </Button>
            </div>
          </div>

          {/* Training blocks */}
          <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                Training blocks
              </div>
              <InfoPopover text="Enable specific emphasis blocks the planner should schedule." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={vo2}
                onClick={() => setPref("vo2max_training", !vo2)}
              >
                VO₂max (run)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={ftp}
                onClick={() => setPref("ftp_training", !ftp)}
              >
                FTP (ride)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={thr}
                onClick={() => setPref("threshold_focus", !thr)}
              >
                Threshold focus (Z3/Z4)
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}