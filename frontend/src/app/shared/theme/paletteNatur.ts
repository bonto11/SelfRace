// src/shared/theme/paletteNatur.ts
// Palette: NATUR (Forest Glass + Soft Yellow accents)
// IMPORTANT: raw values only, prefixed natur_

export const natur = {
  // --- Backgrounds ---
  natur_backgroundMain: "#0A2814",
  natur_backgroundAlt: "#0A1E14",

  // --- Glass surfaces (cards, modals) ---
  natur_surfaceGlass: "rgba(10, 30, 20, 0.50)",
  natur_surfaceGlassHover: "rgba(10, 40, 20, 0.70)",

  // Default border (globálny, neutrál)
  natur_borderGlass: "#123025",

  // Widget border (soft yellow)
  natur_borderWidget: "rgba(232, 213, 135, 0.42)",

  // Optional deeper surface
  natur_surfaceSolid: "#0B1F16",
  natur_surfaceSolidHover: "#0E261B",

  // --- Text ---
  natur_textPrimary: "#EAF4EF",
  natur_textSecondary: "#B2C7BE",
  natur_textMuted: "#86A196",
  natur_textInverse: "#07110D",

  // --- Accents ---
  natur_accentTeal: "#2DD4BF",
  natur_accentLime: "#A3E635",

  natur_accentYellowSoft: "#E8D587",
  natur_accentYellowDim: "rgba(232, 213, 135, 0.18)",

  // --- Neutral lines / overlays ---
  natur_divider: "rgba(18, 48, 37, 0.55)",
  natur_overlay: "rgba(0,0,0,0.45)",

  // --- Status colors ---
  natur_statusSuccess: "#2BBE8D",
  natur_statusWarning: "#D8B24A",
  natur_statusError: "#F0545E",
  natur_statusErrorHover: "#E04852",
  natur_statusInfo: "#4FB6FF",

  // --- Focus / ring ---
  natur_focusRing: "rgba(63, 225, 166, 0.28)",

  // --- Buttons / pills (raw values) ---
  natur_buttonGhostBg: "rgba(0,0,0,0.00)",
  natur_buttonGhostBgHover: "rgba(232, 213, 135, 0.10)",

  natur_pillBg: "rgba(10, 26, 19, 0.55)",
  natur_pillBgHover: "rgba(10, 26, 19, 0.70)",
  natur_pillBorder: "#123025",

  natur_pillActiveBg: "rgba(63, 225, 166, 0.16)",
  natur_pillActiveBorder: "rgba(63, 225, 166, 0.38)",

  // --- Inputs (DEFAULT – tmavé/glass) ---
  natur_inputBg: "rgba(10, 26, 19, 0.42)",
  natur_inputBgHover: "rgba(10, 26, 19, 0.55)",
  natur_inputBorder: "#123025",
  natur_inputBorderFocus: "rgba(63, 225, 166, 0.55)",

  // --- Inputs (EDITABLE – svetlozelené, len na edit) ---
  natur_editableBg: "#C0DDA1",
  natur_editableBgHover: "#B7D595",
  natur_editableBorder: "#7FA35B",
  natur_editableBorderFocus: "#BFF159",
  natur_editableText: "#16240F",
  natur_editablePlaceholder: "#2A3A1C",

  // --- Brand greens ---
  natur_greenPrimary: "#3FE1A6",
  natur_greenSoft: "#2BBE8D",
  natur_greenMuted: "#1E7F61",

  // --- MAIN button (save vibe) ---
  natur_main: "#BFF159",
  natur_mainSoft: "#B2EA53",
  natur_mainButtonText: "#16240F",

  // --- Slider ---
  natur_sliderTrack: "rgba(18, 48, 37, 0.55)",
  natur_sliderTrackActive: "rgba(63, 225, 166, 0.65)",
  natur_sliderThumb: "#3FE1A6",
  natur_sliderThumbRing: "rgba(63, 225, 166, 0.35)",

  // --- Charts ---
  natur_chartLine1: "#3FE1A6",
  natur_chartLine2: "#2DD4BF",
  natur_chartLine3: "#4FB6FF",
  natur_chartLine4: "#A3E635",
  natur_chartGrid: "rgba(18, 48, 37, 0.55)",
  natur_chartAxis: "rgba(178, 199, 190, 0.70)",

  // --- Tooltip / toast ---
  natur_panelBg: "rgba(9, 24, 18, 0.92)",
  natur_panelBorder: "#123025",

  // --- Shadows ---
  natur_shadowSoft: "0 10px 30px rgba(0,0,0,0.35)",
  natur_shadowCard: "0 14px 50px rgba(0,0,0,0.55)",
} as const;

export type NaturPalette = typeof natur;