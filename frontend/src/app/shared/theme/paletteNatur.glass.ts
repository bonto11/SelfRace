// src/shared/theme/paletteNatur.glass.ts
// Palette: NATUR (Forest Glass)
// IMPORTANT: raw values only, prefixed natur_

export const natur = {
  // --- Backgrounds ---
  natur_backgroundMain: "#07110D",
  natur_backgroundAlt: "#091812",

  // --- Glass surfaces (cards, modals) ---
  // jemne "zelené sklo" (nie biela hmla)
  natur_surfaceGlass: "rgba(10, 26, 19, 0.55)",
  natur_surfaceGlassHover: "rgba(10, 26, 19, 0.70)",
  natur_borderGlass: "#123025", // tmavozelený border (preč s bielymi rámami)

  // Optional deeper surface for dense widgets / tables
  natur_surfaceSolid: "#0B1F16",
  natur_surfaceSolidHover: "#0E261B",

  // --- Text ---
  natur_textPrimary: "#EAF4EF",
  natur_textSecondary: "#B2C7BE",
  natur_textMuted: "#86A196",
  natur_textInverse: "#07110D",

  // --- Brand greens (bledšie, moderné) ---
  natur_greenPrimary: "#3FE1A6",
  natur_greenSoft: "#2BBE8D",
  natur_greenMuted: "#1E7F61",

  // --- Accents (use sparingly) ---
  natur_accentTeal: "#2DD4BF",
  natur_accentLime: "#A3E635",

  // --- Neutral lines / overlays ---
  natur_divider: "rgba(18, 48, 37, 0.55)", // ladí s borderom
  natur_overlay: "rgba(0,0,0,0.45)",

  // --- Status colors ---
  natur_statusSuccess: "#2BBE8D",
  natur_statusWarning: "#D8B24A", // tlmené “gold”, nekričí
  natur_statusError: "#F0545E",
  natur_statusErrorHover: "#E04852",
  natur_statusInfo: "#4FB6FF",

  // --- Focus / ring ---
  natur_focusRing: "rgba(63, 225, 166, 0.40)",
  natur_ringSoft: "rgba(63, 225, 166, 0.28)",

  // --- Buttons / pills (raw values) ---
  natur_buttonGhostBg: "rgba(0,0,0,0.00)",
  natur_buttonGhostBgHover: "rgba(18, 48, 37, 0.35)",

  natur_pillBg: "rgba(10, 26, 19, 0.55)",
  natur_pillBgHover: "rgba(10, 26, 19, 0.70)",
  natur_pillBorder: "#123025",
  natur_pillActiveBg: "rgba(63, 225, 166, 0.16)",
  natur_pillActiveBorder: "rgba(63, 225, 166, 0.38)",

  // --- Inputs (raw values) ---
  natur_inputBg: "rgba(10, 26, 19, 0.42)",
  natur_inputBgHover: "rgba(10, 26, 19, 0.55)",
  natur_inputBorder: "#123025",
  natur_inputBorderFocus: "rgba(63, 225, 166, 0.55)",

  // --- Slider (raw values) ---
  natur_sliderTrack: "rgba(18, 48, 37, 0.55)",
  natur_sliderTrackActive: "rgba(63, 225, 166, 0.65)",
  natur_sliderThumb: "#3FE1A6",
  natur_sliderThumbRing: "rgba(63, 225, 166, 0.35)",

  // --- Charts (raw tokens) ---
  natur_chartLine1: "#3FE1A6",
  natur_chartLine2: "#2DD4BF",
  natur_chartLine3: "#4FB6FF",
  natur_chartLine4: "#A3E635",
  natur_chartGrid: "rgba(18, 48, 37, 0.55)",
  natur_chartAxis: "rgba(178, 199, 190, 0.70)",

  // --- Tooltip / toast (raw tokens) ---
  natur_panelBg: "rgba(9, 24, 18, 0.92)",
  natur_panelBorder: "#123025",

  // --- Shadows ---
  natur_shadowSoft: "0 10px 30px rgba(0,0,0,0.35)",
  natur_shadowCard: "0 14px 50px rgba(0,0,0,0.55)",
} as const;

export type NaturPalette = typeof natur;