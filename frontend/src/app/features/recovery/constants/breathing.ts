// Dychové cvičenia (prehrávač BreathingPlayer, stránka /recovery/breathing).
// Texty v i18n breathing.patterns.<id>.

export type BreathPhase = { kind: "in" | "hold" | "out" | "holdOut"; sec: number };

export type BreathingPatternId = "calm" | "coherent" | "box" | "sleep";

export type BreathingPattern = { id: BreathingPatternId; phases: BreathPhase[] };

export const BREATHING_PATTERNS: BreathingPattern[] = [
  // dlhší výdych upokojí – po tréningu, pri strese
  { id: "calm", phases: [{ kind: "in", sec: 4 }, { kind: "out", sec: 6 }] },
  // ~6 dychov za minútu (rezonančné dýchanie)
  { id: "coherent", phases: [{ kind: "in", sec: 5 }, { kind: "out", sec: 5 }] },
  // štvorcové – sústredenie, pred pretekom
  {
    id: "box",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 4 },
      { kind: "out", sec: 4 },
      { kind: "holdOut", sec: 4 },
    ],
  },
  // 4-7-8 – pred spaním
  {
    id: "sleep",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 7 },
      { kind: "out", sec: 8 },
    ],
  },
];

export const BREATHING_MINUTES = [2, 5, 10];

/** deň posledného dokončeného cvičenia – ranný zápis regenerácie ho predvyplní */
export const breathingDoneKey = (userId: number) => `sr:breathing:v1:${userId}`;
