// src/shared/theme/paletteNatur.ts
// Palette: NATUR (Forest Glass + Soft Yellow accents)
// IMPORTANT: raw values only, prefixed 

export const natur = {
  // --- Backgrounds ---
  backgroundMain: "#0A2814",
  backgroundAlt: "#0A1E14",

  // --- Glass surfaces (cards, modals) ---
  surfaceGlass: "rgba(10, 30, 20, 0.50)",
  surfaceGlassHover: "rgba(10, 40, 20, 0.70)",

  // --- Solid surfaces (optional deeper surface) ---
  surfaceSolid: "#0B1F16",
  surfaceSolidHover: "#0E261B",

  // --- Borders ---
  // Default border (globálny, neutrál)
  borderGlass: "#123025",
  // Widget border (soft yellow)
  borderWidget: "rgba(232, 213, 135, 0.42)",

  // --- Text ---
  textPrimary: "#EAF4EF",
  textSecondary: "#B2C7BE",
  textMuted: "#86A196",
  textInverse: "#07110D",

  // --- Accents ---
  accentTeal: "#2DD4BF",
  accentLime: "#A3E635",
  accentYellowSoft: "#E8D587",
  accentYellowDim: "rgba(232, 213, 135, 0.18)",

  // --- Neutral lines / overlays ---
  divider: "rgba(18, 48, 37, 0.55)",
  overlay: "rgba(0,0,0,0.45)",

  // --- Status colors ---
  statusSuccess: "#2BBE8D",
  statusWarning: "#D8B24A",
  statusError: "#F0545E",
  statusErrorHover: "#E04852",
  statusInfo: "#4FB6FF",

  // --- Focus / ring ---
  focusRing: "rgba(63, 225, 166, 0.28)",

  // --- Buttons / pills (raw values) ---
  buttonGhostBg: "rgba(0,0,0,0.00)",
  buttonGhostBgHover: "rgba(232, 213, 135, 0.10)",

  pillBg: "rgba(10, 26, 19, 0.55)",
  pillBgHover: "rgba(10, 26, 19, 0.70)",
  pillBorder: "#123025",
  pillActiveBg: "rgba(63, 225, 166, 0.16)",
  pillActiveBorder: "rgba(63, 225, 166, 0.38)",

  // --- Inputs (DEFAULT – tmavé/glass) ---
  inputBg: "rgba(10, 26, 19, 0.42)",
  inputBgHover: "rgba(10, 26, 19, 0.55)",
  inputBorder: "#123025",
  inputBorderFocus: "rgba(63, 225, 166, 0.55)",

  // --- Inputs (EDITABLE – svetlozelené, len na edit) ---
  editableBg: "#C0DDA1",
  editableBgHover: "#B7D595",
  editableBorder: "#7FA35B",
  editableBorderFocus: "#BFF159",
  editableText: "#16240F",
  editablePlaceholder: "#2A3A1C",

  // --- Brand greens ---
  greenPrimary: "#3FE1A6",
  greenSoft: "#2BBE8D",
  greenMuted: "#1E7F61",

  // --- MAIN button (save vibe) ---
  main: "#BFF159",
  mainSoft: "#B2EA53",
  mainButtonText: "#16240F",

  // --- Slider ---
  sliderTrack: "rgba(18, 48, 37, 0.55)",
  sliderTrackActive: "rgba(63, 225, 166, 0.65)",
  sliderThumb: "#3FE1A6",
  sliderThumbRing: "rgba(63, 225, 166, 0.35)",

  // --- Charts ---
  chartLine1: "#D5BC79",
  chartLine2: "#924819",
  chartLine3: "#C38032",
  chartLine4: "#888343",
  chartLine5: "#A7735E",
  chartLine6: "#554954",
  chartLine7: "#65452C",
  chartLine8: "#636C73",
  chartGrid:  "rgba(255, 255, 255, 0.30)",
  chartGridSoft: "rgba(255, 255, 255, 0.20)",
  chartAxis: "rgba(178, 199, 190, 0.70)",
  chartBandFill: "rgba(16,185,129,0.15)",

  stateExcellent : '#00E676', // neon green (jasne TOP)
  stateSuperior  : '#16A34A', // deep emerald (2. v poradí, stále zelené)
  stateGood      : '#14B8A6', // teal (prechod k modrej)
  stateFair      : '#60A5FA', // sky-400 (naša bežná modrá)
  statePoor      : '#EF4444', // red (jasné varovanie)
  stateNeutral   : '#64748B', // sivá

  //STATE
  stateAthletes  : '#00E676', // TOP = rovnaké ako excellent
  stateFitness   : '#16A34A', // 2. zelené
  stateAverage   : '#22C55E', // emerald-500 (stále “ok”, ale nie teal)
  stateEssential : '#EF4444', // červená
  stateObese     : '#EF4444', // červená

  stateBad       : '#EF4444', // červená
  stateDanger    : '#60A5FA', // “↓ OK” – modrá (match s bike)
  statePositive  : '#00E676', // “↑ OK” – zhodné s excellent/athletes
  stateWarning   : '#F59E0B', // pozor – jantár (match so strength)
  stateCool      : '#38BDF8', // “↓ OK” – modrá (match s bike)

  //phase
  phaseBase: "#10B981",
  phaseBuild: "#6366F1",
  phasePeak: "#F59E0B",
  phaseRecovery: "##22C55E",

  // --- Tooltip / toast / panels ---
  panelBg: "rgba(9, 24, 18, 0.92)",
  panelBorder: "#123025",

  // --- Shadows ---
  shadowSoft: "0 10px 30px rgba(0,0,0,0.35)",
  shadowCard: "0 14px 50px rgba(0,0,0,0.55)",
} as const;

export type NaturPalette = typeof natur;