// src/features/coach/components/IntensityModelsSection.tsx
"use client";

import { useEffect, useState } from "react";
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

  // always keep exactly one model selected; default to polarized
  useEffect(() => {
    if (!pol && !pyr) {
      setLocal((p: any) => ({
        ...p,
        polarized_model: true,
        pyramidal_model: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pol, pyr]);

  const setModel = (model: "polarized" | "pyramidal") => {
    setLocal((p: any) => ({
      ...p,
      polarized_model: model === "polarized",
      pyramidal_model: model === "pyramidal",
    }));
  };

  // closed preview text
  const modelLabel = pol ? "Polarized 80/20" : "Pyramidal";
  const blocks: string[] = [];
  if (vo2) blocks.push("VO₂");
  if (ftp) blocks.push("FTP");
  if (thr) blocks.push("THR");
  const blocksLabel = blocks.length ? blocks.join(" · ") : "none";

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Intensity models & specific blocks
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Polarized ≈80% easy / 20% hard — great for time-crunched or injury-prone; Pyramidal = most time easy, less tempo, least hard — suits higher volume & race prep. Enable VO₂/FTP/Threshold blocks to schedule emphasis phases." />
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
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs select-none",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <span className="opacity-70 mr-1">Model:</span>
              <span className="font-semibold">{modelLabel}</span>
            </div>
            <div className="opacity-40">|</div>
            <div className="flex items-center gap-2">
              <span className="opacity-70">Blocks:</span>
              <div className="flex items-center gap-1">
                {blocks.length ? (
                  blocks.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/15 opacity-85"
                    >
                      {b}
                    </span>
                  ))
                ) : (
                  <span className="opacity-80">none</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-3">
          {/* Intensity models */}
          <div className={[SURFACE_INLINE, "px-3 py-2 rounded-xl"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                Intensity models
              </div>
              <InfoPopover text="Pick one model. Polarized emphasizes very easy + very hard; Pyramidal adds more tempo/threshold in the middle." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={pol}
                onClick={() => setModel("polarized")}
              >
                Polarized (80/20)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={pyr}
                onClick={() => setModel("pyramidal")}
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
              <InfoPopover text="Enable emphasis blocks that the planner can schedule within the chosen model (e.g., VO₂max microcycle for running, FTP for cycling, Threshold focus for Z3/Z4)." />
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