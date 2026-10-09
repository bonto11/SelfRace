// src/app/shared/ui/theme/paletteNatur.ts
// Paleta NATUR (lesné sklo + jemná žltá)
//
// PRAVIDLÁ:
// - Len surové farby, žiadna sémantika (tú robí app_colors.ts).
// - Priehľadné varianty sa tu NEPÍŠU - app_colors si ich odvodí cez alpha().
//   Tak nová paleta = nový súbor s rovnakými kľúčmi a zmena importu v app_colors.
// - Hex vždy "#RRGGBB" (alpha() s ním počíta).

export const natur = {
  // --- Pozadia a povrchy (od najsvetlejšieho po najtmavší) ---
  bg: "#0A2814", // hlavné pozadie appky
  bgAlt: "#0A1E14", // druhé pozadie, sklo kariet
  surface: "#0B1F16", // plný povrch (karta bez skla, tooltip)
  surfaceRaised: "#132B1E", // vyvýšený plný povrch (otvorené menu výberu)
  deep: "#0A1A12", // najtmavší zelený (pilulky, panely, polia na čítanie)
  line: "#123025", // rámy a deliace čiary

  // --- Text ---
  text: "#EAF4EF",
  textSoft: "#B2C7BE",
  textMuted: "#86A196",
  onAccent: "#07110D", // text na limetkovom podklade
  white: "#FFFFFF",
  black: "#000000",

  // --- Akcenty ---
  accent: "#BFF159", // limetková - hlavná značka, primárne tlačidlo, úspech
  accentHover: "#BFFF30",
  accentDeep: "#1E7F61", // tlmená tmavá zelená
  mint: "#3FE1A6", // focus, aktívne pilulky, prechody
  highlight: "#E8D587", // jemná žltá - rám widgetov, hover ghost tlačidiel

  // --- Stavy ---
  warning: "#D8B24A",
  error: "#F0545E",
  info: "#4FB6FF",

  // --- Úrovne (VO2max, tuk, kondícia) - od najlepšej ---
  levelExcellent: "#00E676",
  levelSuperior: "#16A34A",
  levelAverage: "#22C55E",
  levelGood: "#14B8A6",
  levelFair: "#60A5FA",
  levelNeutral: "#64748B",

  // --- Fázy plánu ---
  phaseBase: "#10B981",
  phaseBuild: "#6366F1",
  phaseTaper: "#06B6D4",
  phasePeak: "#F59E0B",
  phaseRecovery: "#22C55E",

  // --- Kategorické farby športov (zemité, navzájom odlíšiteľné) ---
  sport: {
    run: "#D5BC79",
    strength: "#924819",
    ride: "#C38032",
    swim: "#888343",
    mixed: "#A7735E",
    skate: "#554954",
    walk: "#65452C",
    other: "#636C73",
    hike: "#7C9070",
    soccer: "#4A7A96",
    hiit: "#B33F3F",
    padel: "#5C8A72",
    pickleball: "#8A9A5C",
    badminton: "#9B6B9E",
    yoga: "#C9A66B",
    pilates: "#B98D6F",
    surfing: "#4682A0",
    rockClimbing: "#6E5849",
    alpineSki: "#8FA9BF",
  },

  // Trendy regenerácie – overené validátorom (dataviz, dark, povrch #0B1F16):
  // L v pásme 0.48–0.67, chroma ≥ 0.1, CVD ΔE ≥ 8, kontrast ≥ 3:1.
  recoveryMain: "#B38A2E",
  recoveryAlt: "#A64B3A",

  // --- Externé značky ---
  strava: "#FC5200",

  // --- Predplatné ---
  tierFamily: "#D8B4E2",
  tierPro: "#FDE047",
  tierClassic: "#94A3B8",
  tierFree: "#3F3F46",
} as const;

export type Palette = typeof natur;
