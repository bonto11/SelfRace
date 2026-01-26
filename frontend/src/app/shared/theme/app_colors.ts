// src/shared/theme/app_colors.ts
// App semantic color map.
// IMPORTANT: references to palette tokens only.

import { natur } from "./paletteNatur";

export const appColors = {
  // Core backgrounds
  backgroundMain: natur.natur_backgroundMain,
  backgroundAlt: natur.natur_backgroundAlt,

  // Surfaces
  surfaceCard: natur.natur_surfaceGlass,
  surfaceCardHover: natur.natur_surfaceGlassHover,
  surfaceSolid: natur.natur_surfaceSolid,
  surfaceSolidHover: natur.natur_surfaceSolidHover,

  // Borders
  surfaceCardBorder: natur.natur_borderGlass, // neutrál (kalendár, línie)
  widgetBorder: natur.natur_borderWidget, // len widgety/karty

  // Accents
  accentYellowSoft: natur.natur_accentYellowSoft,
  accentYellowDim: natur.natur_accentYellowDim,

  divider: natur.natur_divider,
  overlay: natur.natur_overlay,

  // Typography
  textPrimary: natur.natur_textPrimary,
  textSecondary: natur.natur_textSecondary,
  textMuted: natur.natur_textMuted,
  textInverse: natur.natur_textInverse,

  // Brand / accents
  brandPrimary: natur.natur_greenPrimary,
  brandSecondary: natur.natur_greenSoft,
  brandMuted: natur.natur_greenMuted,
  accentTeal: natur.natur_accentTeal,
  accentLime: natur.natur_accentLime,

  // Focus (global)
  focusRing: natur.natur_focusRing,

  // Status
  statusSuccess: natur.natur_statusSuccess,
  statusWarning: natur.natur_statusWarning,
  statusError: natur.natur_statusError,
  statusInfo: natur.natur_statusInfo,

  // Buttons (existing semantics stay)
  buttonPrimaryBg: natur.natur_greenPrimary,
  buttonPrimaryBgHover: natur.natur_greenSoft,
  buttonPrimaryText: natur.natur_textInverse,

  buttonSecondaryBg: natur.natur_surfaceGlass,
  buttonSecondaryBgHover: natur.natur_surfaceGlassHover,
  buttonSecondaryBorder: natur.natur_borderGlass,
  buttonSecondaryText: natur.natur_textPrimary,

  buttonGhostBg: natur.natur_buttonGhostBg,
  buttonGhostBgHover: natur.natur_buttonGhostBgHover,
  buttonGhostText: natur.natur_textPrimary,

  buttonDangerBg: natur.natur_statusError,
  buttonDangerBgHover: natur.natur_statusErrorHover,
  buttonDangerText: natur.natur_textPrimary,

  // MAIN button (new: save vibe)
  buttonMainBg: natur.natur_main,
  buttonMainBgHover: natur.natur_mainSoft,
  buttonMainText: natur.natur_mainButtonText,

  // Pills
  pillBg: natur.natur_pillBg,
  pillBgHover: natur.natur_pillBgHover,
  pillBorder: natur.natur_pillBorder,
  pillText: natur.natur_textSecondary,
  pillActiveBg: natur.natur_pillActiveBg,
  pillActiveBorder: natur.natur_pillActiveBorder,
  pillActiveText: natur.natur_textPrimary,

  // Inputs (DEFAULT – nemeníme; používa kalendár/dashboards/readonly UI)
  inputBg: natur.natur_inputBg,
  inputBgHover: natur.natur_inputBgHover,
  inputBorder: natur.natur_inputBorder,
  inputBorderFocus: natur.natur_inputBorderFocus,
  inputText: natur.natur_textPrimary,
  inputPlaceholder: natur.natur_textMuted,

  // Inputs (READONLY semantics) — mapované na default inputy (safe)
  readonlyBg: natur.natur_inputBg,
  readonlyBgHover: natur.natur_inputBgHover,
  readonlyBorder: natur.natur_inputBorder,
  readonlyBorderFocus: natur.natur_inputBorderFocus,
  readonlyText: natur.natur_textPrimary,
  readonlyPlaceholder: natur.natur_textMuted,
  readonlyRing: natur.natur_focusRing,

  // Inputs (EDITABLE – svetlozelené; len tam kde user upravuje)
  editableBg: natur.natur_editableBg,
  editableBgHover: natur.natur_editableBgHover,
  editableBorder: natur.natur_editableBorder,
  editableBorderFocus: natur.natur_editableBorderFocus,
  editableText: natur.natur_editableText,
  editablePlaceholder: natur.natur_editablePlaceholder,
  // optional, nech je ring rovnaký vibe ako borderFocus
  editableRing: natur.natur_editableBorderFocus,

  // Slider
  sliderTrack: natur.natur_sliderTrack,
  sliderTrackActive: natur.natur_sliderTrackActive,
  sliderThumb: natur.natur_sliderThumb,
  sliderThumbRing: natur.natur_sliderThumbRing,

  // Charts
  chartLine1: natur.natur_chartLine1,
  chartLine2: natur.natur_chartLine2,
  chartLine3: natur.natur_chartLine3,
  chartLine4: natur.natur_chartLine4,
  chartGrid: natur.natur_chartGrid,
  chartAxis: natur.natur_chartAxis,

  // Panels
  panelBg: natur.natur_panelBg,
  panelBorder: natur.natur_panelBorder,
  panelText: natur.natur_textPrimary,

  // Shadows
  shadowSoft: natur.natur_shadowSoft,
  shadowCard: natur.natur_shadowCard,
} as const;

export type AppColors = typeof appColors;