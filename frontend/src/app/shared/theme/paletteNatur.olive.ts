// src/shared/theme/paletteNatur.olive.ts
// Palette: NATUR (Olive Gold)
// IMPORTANT: raw values only, prefixed natur_
//
// Pozn: natur_borderGlass je gold -> bude to gold všade, kde používaš surfaceCardBorder.

export const natur = {
  // --- Backgrounds ---
  natur_backgroundMain: "#07110D",
  natur_backgroundAlt: "#091812",

  // --- Glass surfaces (cards, modals) ---
  natur_surfaceGlass: "rgba(10, 26, 19, 0.55)",
  natur_surfaceGlassHover: "rgba(10, 26, 19, 0.70)",
  natur_borderGlass: "#C9A646", // GOLD border (signature)

  // Optional deeper surface for dense widgets / tables
  natur_surfaceSolid: "#0B1F16",
  natur_surfaceSolidHover: "#0E261B",

  // --- Text ---
  natur_textPrimary: "#EAF4EF",
  natur_textSecondary: "#B2C7BE",
  natur_textMuted: "#86A196",
  natur_textInverse: "#07110D",

  // --- Brand greens (bledšie) ---
  natur_greenPrimary: "#39D9A0",
  natur_greenSoft: "#26B684",
  natur_greenMuted: "#1E7F61",

  // --- Accents (use sparingly) ---
  natur_accentTeal: "#2DD4BF",
  natur_accentLime: "#A3E635",

  // --- Neutral lines / overlays ---
  natur_divider: "rgba(201, 166, 70, 0.35)", // ladí s gold borderom
  natur_overlay: "rgba(0,0,0,0.45)",

  // --- Status colors ---
  natur_statusSuccess: "#26B684",
  natur_statusWarning: "#C9A646", // gold
  natur_statusError: "#F0545E",
  natur_statusErrorHover: "#E04852",
  natur_statusInfo: "#4FB6FF",

  // --- Focus / ring ---
  natur_focusRing: "rgba(201, 166, 70, 0.35)", // jemný gold ring
  natur_ringSoft: "rgba(201, 166, 70, 0.22)",

  // --- Buttons / pills (raw values) ---
  natur_buttonGhostBg: "rgba(0,0,0,0.00)",
  natur_buttonGhostBgHover: "rgba(201, 166, 70, 0.12)",

  natur_pillBg: "rgba(10, 26, 19, 0.55)",
  natur_pillBgHover: "rgba(10, 26, 19, 0.70)",
  natur_pillBorder: "rgba(201, 166, 70, 0.55)",
  natur_pillActiveBg: "rgba(201, 166, 70, 0.16)",
  natur_pillActiveBorder: "rgba(201, 166, 70, 0.55)",

  // --- Inputs (raw values) ---
  natur_inputBg: "rgba(10, 26, 19, 0.42)",
  natur_inputBgHover: "rgba(10, 26, 19, 0.55)",
  natur_inputBorder: "rgba(201, 166, 70, 0.45)",
  natur_inputBorderFocus: "rgba(201, 166, 70, 0.70)",

  // --- Slider (raw values) ---
  natur_sliderTrack: "rgba(201, 166, 70, 0.22)",
  natur_sliderTrackActive: "rgba(201, 166, 70, 0.65)",
  natur_sliderThumb: "#C9A646",
  natur_sliderThumbRing: "rgba(201, 166, 70, 0.35)",

  // --- Charts (raw tokens) ---
  natur_chartLine1: "#39D9A0",
  natur_chartLine2: "#2DD4BF",
  natur_chartLine3: "#4FB6FF",
  natur_chartLine4: "#C9A646", // 4. linka gold
  natur_chartGrid: "rgba(201, 166, 70, 0.20)",
  natur_chartAxis: "rgba(178, 199, 190, 0.70)",

  // --- Tooltip / toast (raw tokens) ---
  natur_panelBg: "rgba(9, 24, 18, 0.92)",
  natur_panelBorder: "rgba(201, 166, 70, 0.55)",

  // --- Shadows ---
  natur_shadowSoft: "0 10px 30px rgba(0,0,0,0.35)",
  natur_shadowCard: "0 14px 50px rgba(0,0,0,0.55)",
} as const;

export type NaturPalette = typeof natur;