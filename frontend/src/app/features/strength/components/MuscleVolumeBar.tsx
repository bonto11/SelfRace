// src/app/features/strength/components/MuscleVolumeBar.tsx
"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import type { MuscleVolumeOverview } from "@/app/features/strength/api/strength_sessions";

export type Bands = MuscleVolumeOverview["bands"];

/** Farby zvislých rysiek. Širšie a sýtejšie - tenká modrá nebola vidieť. */
export const TICK_MAINTAIN = "#38bdf8"; // hranica udržania
export const TICK_DEVELOP = "#4ade80";  // hranica rastu
export const TICK_TARGET = "#ffffff";   // individuálny cieľ

export const TICK_WIDTH = 3;

/** Stav podľa celkového objemu voči cieľu - zhodné s compare_to_target na BE. */
export function volumeColor(total: number, target: number): string {
  if (total <= 0 || target <= 0) return appColors.textMuted;
  const pct = (total / target) * 100;
  if (pct < 60) return appColors.statusWarning;
  if (pct <= 130) return appColors.statusSuccess;
  return appColors.statusWarning;
}

/** 12 -> "12", 1.5 -> "1.5" */
export function fmtSets(v: number): string {
  return String(Number(v.toFixed(1)));
}

function Tick({
  value,
  scaleMax,
  color,
  strong = false,
}: {
  value: number;
  scaleMax: number;
  color: string;
  strong?: boolean;
}) {
  if (value <= 0 || value > scaleMax) return null;
  return (
    <div
      className="absolute inset-y-0 rounded-sm"
      style={{
        left: `${(value / scaleMax) * 100}%`,
        width: strong ? TICK_WIDTH + 1 : TICK_WIDTH,
        background: color,
        transform: "translateX(-50%)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.45)",
      }}
    />
  );
}

/**
 * Jeden pásik objemu. Používa ho karta prehľadu aj živý náhľad pri
 * plánovaní/zapisovaní, aby mali rovnaký vzhľad.
 *
 * done:  už odcvičené / práve zapisované - plná farba
 * added: prírastok. "planned" = sivý (iba naplánované),
 *        "logged" = svetlejší odtieň farby (práve zapisuješ)
 */
export default function MuscleVolumeBar({
  done,
  added = 0,
  target,
  bands,
  scaleMax,
  addedKind = "planned",
}: {
  done: number;
  added?: number;
  target: number;
  bands: Bands;
  scaleMax: number;
  addedKind?: "planned" | "logged";
}) {
  const total = done + added;
  const color = volumeColor(total, target);
  const w = (v: number) => `${Math.min((v / scaleMax) * 100, 100)}%`;

  return (
    <div
      className="relative h-2.5 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.08)" }}
    >
      {/* prírastok */}
      {added > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: w(total),
            background: addedKind === "planned" ? "rgba(255,255,255,0.3)" : color,
            opacity: addedKind === "planned" ? 1 : 0.45,
          }}
        />
      )}
      {/* už odcvičené */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: w(done), background: color }}
      />

      <Tick value={bands.maintenance_min} scaleMax={scaleMax} color={TICK_MAINTAIN} />
      <Tick value={bands.development_min} scaleMax={scaleMax} color={TICK_DEVELOP} />
      <Tick value={target} scaleMax={scaleMax} color={TICK_TARGET} strong />
    </div>
  );
}