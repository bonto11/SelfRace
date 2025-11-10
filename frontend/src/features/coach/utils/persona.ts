// src/features/coach/utils/persona.ts
import type { CoachPersona } from "@/features/coach/types/prefsTypes";

export const PERSONA_TONES: Record<Exclude<CoachPersona, "custom">, {
  directness: number; praise: number; challenge: number; emoji: number; explain: number;
}> = {
  drill_sergeant: { directness: 85, praise: 15, challenge: 90, emoji: 5,  explain: 40 },
  motivator:      { directness: 55, praise: 80, challenge: 60, emoji: 35, explain: 55 },
  analyst:        { directness: 65, praise: 35, challenge: 55, emoji: 10, explain: 90 },
  realist:        { directness: 70, praise: 40, challenge: 65, emoji: 10, explain: 60 },
};

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}