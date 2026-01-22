// src/shared/theme/paletteNatur.ts
<<<<<<< HEAD
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
=======
// Palette: NATUR (Forest Glass + Soft Yellow accents)
// IMPORTANT: raw values only, prefixed natur_

export const natur = {
  // --- Backgrounds ---
  natur_backgroundMain: "#0A2814",   //main back
  natur_backgroundAlt: "#0A1E14",     //topbar

  // --- Glass surfaces (cards, modals) ---
  // jemne "zelené sklo" (nie biela hmla)
  natur_surfaceGlass: "rgba(10, 30, 20, 0.50)",
  natur_surfaceGlassHover: "rgba(10, 40, 20, 0.70)",

  // Default border (globálny, neutrál) – nech kalendár dni nie sú žlté
  natur_borderGlass: "#123025",

  // NEW: widget border (soft yellow) – len pre karty/widgety
  // bledá žltá, tlmená, nekričí, ale odlíši “kartu” od pozadia
  natur_borderWidget: "rgba(232, 213, 135, 0.42)",      //not seen?

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
>>>>>>> cf0538bfc6c0d0e5c1dada1f9d088860bc501c80

  // --- Accents (use sparingly) ---
  natur_accentTeal: "#2DD4BF",
  natur_accentLime: "#A3E635",

<<<<<<< HEAD
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
=======
  // NEW: Soft yellow accents (namiesto bielej na UI prvkoch, nie text)
  natur_accentYellowSoft: "#E8D587",
  natur_accentYellowDim: "rgba(232, 213, 135, 0.18)",

  // --- Neutral lines / overlays ---
  natur_divider: "rgba(18, 48, 37, 0.55)",
  natur_overlay: "rgba(0,0,0,0.45)",

  // --- Status colors ---
  natur_statusSuccess: "#2BBE8D",
  natur_statusWarning: "#D8B24A", // tlmené “gold-ish”, používať jemne
  natur_statusError: "#F0545E",
  natur_statusErrorHover: "#E04852",
  natur_statusInfo: "#4FB6FF",

  // --- Focus / ring ---
  // ring ostáva zelený (prirodzenejší)
  natur_focusRing: "rgba(63, 225, 166, 0.40)",
  natur_ringSoft: "rgba(63, 225, 166, 0.28)",

  // --- Buttons / pills (raw values) ---
  natur_buttonGhostBg: "rgba(0,0,0,0.00)",

  // NEW: ghost hover môže ísť do jemnej žltej (namiesto bielej)
  natur_buttonGhostBgHover: "rgba(232, 213, 135, 0.10)",

  natur_pillBg: "rgba(10, 26, 19, 0.55)",
  natur_pillBgHover: "rgba(10, 26, 19, 0.70)",
  natur_pillBorder: "#123025",

  // Active pill má jemný zelený “glow” – nech žltá nie je všade
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
>>>>>>> cf0538bfc6c0d0e5c1dada1f9d088860bc501c80
} as const;

export type NaturPalette = typeof natur;