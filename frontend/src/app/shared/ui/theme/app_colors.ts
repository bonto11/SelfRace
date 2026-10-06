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

  // Borders
  surfaceCardBorder: natur.borderGlass,
  widgetBorder: natur.borderWidget,

  // Accents
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
  brandDark: natur.darkGreen,
  brandLight: natur.light,
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


  buttonMainBg: natur.main,
  buttonMainText: natur.mainButtonText,

  // Pills
  pillBg: natur.pillBg,
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

  // Charts
  chartLine1: natur.chartLine1,
  chartLine2: natur.chartLine2,
  chartLine3: natur.chartLine3,
  chartLine4: natur.chartLine4,
  chartGrid: natur.chartGrid,
  chartBandFill: natur.chartBandFill,
  chartRecoveryMain: natur.chartRecoveryMain,
  chartRecoveryAlt: natur.chartRecoveryAlt,

  chartRun: natur.chartLine1,
  chartStrength: natur.chartLine2,
  chartBike: natur.chartLine3,
  chartSwim: natur.chartLine4,
  chartMixed: natur.chartLine5,
  chartSkate: natur.chartLine6,
  chartWalk: natur.chartLine7,
  chartOther: natur.chartLine8,
  // 🌟 NOVÉ - doplnené pre kategórie, ktoré predtým nemali vlastnú farbu
  // v grafoch vôbec (hike, soccer boli tiché medzery) alebo padali do
  // other/mixed a teraz majú vlastný sport_type_fe (hiit, padel,
  // pickleball, badminton, yoga, pilates, surfing, rock_climbing,
  // alpine_ski) - pozri Services/sport_type.py.
  chartHike: natur.chartLine9,
  chartSoccer: natur.chartLine10,
  chartHiit: natur.chartLine11,
  chartPadel: natur.chartLine12,
  chartPickleball: natur.chartLine13,
  chartBadminton: natur.chartLine14,
  chartYoga: natur.chartLine15,
  chartPilates: natur.chartLine16,
  chartSurfing: natur.chartLine17,
  chartRockClimbing: natur.chartLine18,
  chartAlpineSki: natur.chartLine19,

  //State
  stateExcellent: natur.stateExcellent,
  stateSuperior: natur.stateSuperior,
  stateGood: natur.stateGood,
  stateFair: natur.stateFair,
  statePoor: natur.statusError,
  stateNeutral: natur.stateNeutral,

  stateAthletes: natur.stateAthletes,
  stateFitness: natur.stateFitness,
  stateAverage: natur.stateAverage,
  stateEssential: natur.statusError,
  stateObese: natur.statusError,

  // stavové alias-y: danger/bad = chyba, warning = pozor – rovnaké farby ako status*
  stateBad: natur.statusError,
  stateDanger: natur.statusError,
  stateWarning: natur.statusWarning,

  //phase
  phaseBase: natur.phaseBase,
  phaseBuild: natur.phaseBuild,
  phaseTaper: natur.phaseTaper,
  phasePeak: natur.phasePeak,
  phaseRecovery: natur.phaseRecovery,

  // Panels
  panelBg: natur.panelBg,
  panelBorder: natur.panelBorder,
  panelText: natur.textPrimary,

  // Shadows
  shadowSoft: natur.shadowSoft,
  shadowCard: natur.shadowCard,

  //Strava
  backgroundStrava: natur.backgroundStrava,
  textStrava: natur.textStrava,

  // Tiers
  brandFamily: natur.tierFamily,
  brandPro: natur.tierPro,
  brandClassic: natur.tierClassic,
  brandFree: natur.tierFree,
} as const;

export type AppColors = typeof appColors;
