// src/shared/theme/paletteNatur.ts
// Palette: NATUR (Dark Green + Glass)
// IMPORTANT: This file contains ALL raw color/shadow values (hex/rgba),
// prefixed with `natur_`. No app semantic names here.

export const natur = {
  // --- Backgrounds ---
  natur_backgroundMain: "#0B1411",
  natur_backgroundAlt: "#0F1C17",

  // --- Glass surfaces (cards, modals) ---
  natur_surfaceGlass: "rgba(255,255,255,0.04)",
  natur_surfaceGlassHover: "rgba(255,255,255,0.07)",
  natur_borderGlass: "rgba(255,255,255,0.08)",

  // Optional deeper surface for dense widgets / tables
  natur_surfaceSolid: "#10211A",
  natur_surfaceSolidHover: "#142920",

  // --- Text ---
  natur_textPrimary: "#E6F4EA",
  natur_textSecondary: "#9FB8A9",
  natur_textMuted: "#6B8F7C",
  natur_textInverse: "#0B1411",

  // --- Brand greens ---
  natur_greenPrimary: "#4ADE80",
  natur_greenSoft: "#22C55E",
  natur_greenMuted: "#166534",

  // --- Accents (use sparingly) ---
  natur_accentTeal: "#2DD4BF",
  natur_accentLime: "#A3E635",

  // --- Neutral lines / overlays ---
  natur_divider: "rgba(255,255,255,0.06)",
  natur_overlay: "rgba(0,0,0,0.35)",

  // --- Status colors ---
  natur_statusSuccess: "#22C55E",
  natur_statusWarning: "#F59E0B",
  natur_statusError: "#EF4444",
  natur_statusErrorHover: "#DC2626",
  natur_statusInfo: "#38BDF8",

  // --- Focus / ring ---
  natur_focusRing: "rgba(74,222,128,0.45)",
  natur_ringSoft: "rgba(74,222,128,0.35)",

  // --- Buttons / pills (raw values) ---
  natur_buttonGhostBg: "rgba(255,255,255,0.00)",
  natur_buttonGhostBgHover: "rgba(255,255,255,0.06)",

  natur_pillBg: "rgba(255,255,255,0.04)",
  natur_pillBgHover: "rgba(255,255,255,0.07)",
  natur_pillBorder: "rgba(255,255,255,0.08)",
  natur_pillActiveBg: "rgba(74,222,128,0.14)",
  natur_pillActiveBorder: "rgba(74,222,128,0.35)",

  // --- Inputs (raw values) ---
  natur_inputBg: "rgba(255,255,255,0.03)",
  natur_inputBgHover: "rgba(255,255,255,0.05)",
  natur_inputBorder: "rgba(255,255,255,0.08)",
  natur_inputBorderFocus: "rgba(74,222,128,0.45)",

  // --- Slider (raw values) ---
  natur_sliderTrack: "rgba(255,255,255,0.10)",
  natur_sliderTrackActive: "rgba(74,222,128,0.55)",
  natur_sliderThumb: "#4ADE80", // same as natur_greenPrimary, but explicit raw token
  natur_sliderThumbRing: "rgba(74,222,128,0.35)",

  // --- Charts (raw tokens) ---
  natur_chartLine1: "#4ADE80",
  natur_chartLine2: "#2DD4BF",
  natur_chartLine3: "#38BDF8",
  natur_chartLine4: "#A3E635",
  natur_chartGrid: "rgba(255,255,255,0.08)",
  natur_chartAxis: "rgba(159,184,169,0.65)",

  // --- Tooltip / toast (raw tokens) ---
  natur_panelBg: "rgba(15,28,23,0.92)",
  natur_panelBorder: "rgba(255,255,255,0.10)",

  // --- Shadows ---
  natur_shadowSoft: "0 10px 30px rgba(0,0,0,0.35)",
  natur_shadowCard: "0 12px 40px rgba(0,0,0,0.45)",
} as const;

export type NaturPalette = typeof natur;