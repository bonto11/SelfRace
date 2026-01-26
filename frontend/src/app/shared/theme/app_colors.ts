// src/shared/theme/app_colors.ts
// App semantic color map.
// IMPORTANT: references to palette tokens only.

import { natur } from "./paletteNatur";

export const appColors = {
  // Core backgrounds
  backgroundMain: natur.backgroundMain,
  backgroundAlt: natur.backgroundAlt,

  // Surfaces
  surfaceCard: natur.surfaceGlass,
  surfaceCardHover: natur.surfaceGlassHover,
  surfaceSolid: natur.surfaceSolid,
  surfaceSolidHover: natur.surfaceSolidHover,

  // Borders
  surfaceCardBorder: natur.borderGlass,
  widgetBorder: natur.borderWidget,

  // Accents
  accentYellowSoft: natur.accentYellowSoft,
  accentYellowDim: natur.accentYellowDim,

  divider: natur.divider,
  overlay: natur.overlay,

  // Typography
  textPrimary: natur.textPrimary,
  textSecondary: natur.textSecondary,
  textMuted: natur.textMuted,
  textInverse: natur.textInverse,

  // Brand / accents
  brandPrimary: natur.greenPrimary,
  brandSecondary: natur.greenSoft,
  brandMuted: natur.greenMuted,
  accentTeal: natur.accentTeal,
  accentLime: natur.accentLime,

  // Focus
  focusRing: natur.focusRing,

  // Status
  statusSuccess: natur.statusSuccess,
  statusWarning: natur.statusWarning,
  statusError: natur.statusError,
  statusInfo: natur.statusInfo,

  // Buttons
  buttonPrimaryBg: natur.greenPrimary,
  buttonPrimaryBgHover: natur.greenSoft,
  buttonPrimaryText: natur.textInverse,

  buttonSecondaryBg: natur.surfaceGlass,
  buttonSecondaryBgHover: natur.surfaceGlassHover,
  buttonSecondaryBorder: natur.borderGlass,
  buttonSecondaryText: natur.textPrimary,

  buttonGhostBg: natur.buttonGhostBg,
  buttonGhostBgHover: natur.buttonGhostBgHover,
  buttonGhostText: natur.textPrimary,

  buttonDangerBg: natur.statusError,
  buttonDangerBgHover: natur.statusErrorHover,
  buttonDangerText: natur.textPrimary,

  buttonMainBg: natur.main,
  buttonMainBgHover: natur.mainSoft,
  buttonMainText: natur.mainButtonText,

  // Pills
  pillBg: natur.pillBg,
  pillBgHover: natur.pillBgHover,
  pillBorder: natur.pillBorder,
  pillText: natur.textSecondary,
  pillActiveBg: natur.pillActiveBg,
  pillActiveBorder: natur.pillActiveBorder,
  pillActiveText: natur.textPrimary,

  // Inputs (default)
  inputBg: natur.inputBg,
  inputBgHover: natur.inputBgHover,
  inputBorder: natur.inputBorder,
  inputBorderFocus: natur.inputBorderFocus,
  inputText: natur.textPrimary,
  inputPlaceholder: natur.textMuted,

  // Inputs (readonly)
  readonlyBg: natur.inputBg,
  readonlyBgHover: natur.inputBgHover,
  readonlyBorder: natur.inputBorder,
  readonlyBorderFocus: natur.inputBorderFocus,
  readonlyText: natur.textPrimary,
  readonlyPlaceholder: natur.textMuted,
  readonlyRing: natur.focusRing,

  // Inputs (editable)
  editableBg: natur.editableBg,
  editableBgHover: natur.editableBgHover,
  editableBorder: natur.editableBorder,
  editableBorderFocus: natur.editableBorderFocus,
  editableText: natur.editableText,
  editablePlaceholder: natur.editablePlaceholder,
  editableRing: natur.editableBorderFocus,

  // Slider
  sliderTrack: natur.sliderTrack,
  sliderTrackActive: natur.sliderTrackActive,
  sliderThumb: natur.sliderThumb,
  sliderThumbRing: natur.sliderThumbRing,

  // Charts
  chartLine1: natur.chartLine1,
  chartLine2: natur.chartLine2,
  chartLine3: natur.chartLine3,
  chartLine4: natur.chartLine4,
  chartGrid: natur.chartGrid,
  chartAxis: natur.chartAxis,

  // Panels
  panelBg: natur.panelBg,
  panelBorder: natur.panelBorder,
  panelText: natur.textPrimary,

  // Shadows
  shadowSoft: natur.shadowSoft,
  shadowCard: natur.shadowCard,
} as const;

export type AppColors = typeof appColors;