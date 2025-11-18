"use client";

import Button from "@/shared/components/ui/Button";
import { SECTION } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  setPref: (key: any, value: any) => void;
};

export function IntensityModelsSection({ local, setLocal, setPref }: Props) {
  const pol = !!local.polarized_model;
  const pyr = !!local.pyramidal_model;

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Intensity models & specific blocks
        </div>
        <InfoPopover text="Polarized/Pyramidal shape; VO₂max/FTP blocks." />
      </div>

      {/* toggles (checkboxes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!local.vo2max_training}
            onChange={(e) => setPref("vo2max_training", e.target.checked)}
          />
          Include VO₂max blocks (run)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!local.ftp_training}
            onChange={(e) => setPref("ftp_training", e.target.checked)}
          />
          Include FTP blocks (ride)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!local.threshold_focus}
            onChange={(e) => setPref("threshold_focus", e.target.checked)}
          />
          Threshold focus (more Z3/Z4)
        </label>
      </div>

      {/* model pills */}
      <div className="mt-3 flex flex-wrap gap-2">
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
    </section>
  );
}