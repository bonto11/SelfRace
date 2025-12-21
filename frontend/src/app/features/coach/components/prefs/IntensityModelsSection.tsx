// src/features/coach/components/IntensityModelsSection.tsx
"use client";

import { useEffect, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
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

  // --- Invariant: exactly one model selected. If none or both -> default to Polarized.
  useEffect(() => {
    if ((pol && pyr) || (!pol && !pyr)) {
      setLocal((p: any) => ({
        ...p,
        polarized_model: true,
        pyramidal_model: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pol, pyr]);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Intensity models & specific blocks
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Polarized 80/20: ~80% easy Z1–Z2, ~20% hard Z4–Z5 (vhodné pre väčšinu bežcov). Pyramidal: viac času v stredných intenzitách (Z2–Z3), menej v Z4–Z5 (vhodné pre objem, marathon/ultra, cyklo základ). Enable blocks to schedule short emphasis phases." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse intensity section"
            labelWhenClosed="Expand intensity section"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs select-none"].join(
            " "
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="opacity-75">Model:</span>
            <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5">
              {pol ? "Polarized (80/20)" : "Pyramidal"}
            </span>
            <span className="opacity-50">|</span>
            <span className="opacity-75">Blocks:</span>
            {vo2 && (
              <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5">
                VO₂
              </span>
            )}
            {ftp && (
              <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5">
                FTP
              </span>
            )}
            {thr && (
              <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5">
                THR
              </span>
            )}
            {!vo2 && !ftp && !thr && <span className="opacity-60">none</span>}
          </div>
        </div>
      )}

      {/* Open body */}
      {open && (
        <div className="space-y-3">
          {/* Intensity models (radio-like pills) */}
          <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                Intensity models
              </div>
              <InfoPopover text="Select one global distribution model. Radio behavior: exactly one is active." />
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
                    polarized_model: true,
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
                    pyramidal_model: true,
                    polarized_model: false,
                  }))
                }
              >
                Pyramidal
              </Button>
            </div>
          </div>

          {/* Training blocks */}
          <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                Training blocks
              </div>
              <InfoPopover text="Optional emphasis blocks the planner can schedule (VO₂max for top-end, FTP for cycling tempo/sweet-spot, Threshold for Z3/Z4 focus)." />
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
