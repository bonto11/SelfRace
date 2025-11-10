// src/features/coach/utils/persona.ts
import type { CoachPersona } from "@/features/coach/types/prefsTypes";

export type CoachTone = {
  directness: number;  // 0–100
  praise: number;      // 0–100
  challenge: number;   // 0–100
  emoji: number;       // 0–100
  explain: number;     // 0–100
};

export const PERSONA_TONES: Record<Exclude<CoachPersona, "custom">, CoachTone> = {
  // Kaprál (Oldschooler) – prísny drill
  oldschooler: {
    directness: 85,
    praise: 15,
    challenge: 90,
    emoji: 5,
    explain: 40,
  },
  // Hecovač (Parťák) – priateľský motivátor
  motivator: {
    directness: 55,
    praise: 80,
    challenge: 60,
    emoji: 35,
    explain: 55,
  },
  // Štatistik (Inžinier) – vecný, analytický
  analyst: {
    directness: 65,
    praise: 35,
    challenge: 55,
    emoji: 10,
    explain: 90,
  },
  // Realista (Bez cukru) – úprimný pragmatik
  realist: {
    directness: 70,
    praise: 40,
    challenge: 65,
    emoji: 10,
    explain: 60,
  },
};

// bezpečné orezanie rozsahu
export const clamp01 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));