// src/app/shared/ui/theme/app_colors.ts
// Sémantická mapa farieb appky - JEDINÉ miesto, kde komponenty berú farby.
//
// Zmena palety = iný import nižšie (nová paleta musí mať rovnaké kľúče ako
// natur, typ Palette to ustráži). Priehľadné varianty sa odvodzujú cez
// alpha(), takže v palete stačia plné farby.

import { natur as P } from "./paletteNatur";
import { alpha } from "./colorUtils";

export const appColors = {
  // --- Pozadia a povrchy ---
  backgroundMain: P.bg,
  backgroundAlt: P.bgAlt,
  surfaceCard: alpha(P.bgAlt, 0.5),
  surfaceCardHover: alpha(P.bg, 0.7),
  surfaceSolid: P.surface,
  overlay: alpha(P.black, 0.45),

  // --- Rámy a čiary ---
  surfaceCardBorder: P.line,
  widgetBorder: alpha(P.highlight, 0.42),
  divider: alpha(P.line, 0.55),
  accentYellowDim: alpha(P.highlight, 0.18),

  // --- Text ---
  textPrimary: P.text,
  textSecondary: P.textSoft,
  textMuted: P.textMuted,
  textInverse: P.onAccent,

  // --- Značka ---
  brandPrimary: P.accent,
  brandDark: P.deep,
  brandLight: P.white,
  brandMuted: P.accentDeep,
  accentTeal: P.mint,

  // --- Focus ---
  focusRing: alpha(P.mint, 0.28),

  // --- Stavy (chyba/pozor sú len tieto, žiadne ďalšie alias-y) ---
  statusSuccess: P.accent,
  statusWarning: P.warning,
  statusError: P.error,
  statusInfo: P.info,

  // --- Tlačidlá ---
  buttonPrimaryBg: P.accent,
  buttonPrimaryBgHover: P.accentHover,
  buttonPrimaryText: P.onAccent,

  buttonSecondaryBg: alpha(P.bgAlt, 0.5),
  buttonSecondaryBgHover: alpha(P.bg, 0.7),
  buttonSecondaryBorder: P.line,
  buttonSecondaryText: P.text,

  buttonGhostBg: "transparent",
  buttonGhostBgHover: alpha(P.highlight, 0.1),
  buttonGhostText: P.text,

  // --- Pilulky ---
  pillBg: alpha(P.deep, 0.55),
  pillBorder: P.line,
  pillText: P.textSoft,
  pillActiveBg: alpha(P.mint, 0.16),
  pillActiveBorder: alpha(P.mint, 0.38),
  pillActiveText: P.text,

  // --- Polia len na čítanie ---
  readonlyBg: alpha(P.deep, 0.42),
  readonlyBgHover: alpha(P.deep, 0.55),
  readonlyBorder: P.line,
  readonlyBorderFocus: alpha(P.mint, 0.55),
  readonlyText: P.text,
  readonlyPlaceholder: P.textMuted,
  readonlyRing: alpha(P.mint, 0.28),

  // --- Polia na zadávanie (štýl C: mäkké, matné) ---
  // PREČO priehľadná výplň: svetlozelené polia na tmavej appke "vyskakovali";
  // jemne svetlejšia vrstva nad kartou drží pole čitateľné a pokojné
  editableBg: alpha(P.text, 0.07),
  editableBgHover: alpha(P.text, 0.1),
  editableBorder: alpha(P.text, 0.12),
  editableBorderFocus: alpha(P.accent, 0.7),
  editableRing: alpha(P.accent, 0.16),
  editableText: P.white,
  editablePlaceholder: alpha(P.text, 0.45),
  // menu výberu musí byť plné - priehľadné by prepúšťalo obsah pod ním
  editableMenuBg: P.surfaceRaised,

  sliderTrack: alpha(P.line, 0.55),

  // --- Grafy ---
  chartGrid: alpha(P.white, 0.3),
  chartBandFill: alpha(P.phaseBase, 0.15),
  chartRecoveryMain: P.recoveryMain,
  chartRecoveryAlt: P.recoveryAlt,
  // všeobecné série grafov = prvé športové farby
  chartLine1: P.sport.run,
  chartLine2: P.sport.strength,
  chartLine3: P.sport.ride,
  chartLine4: P.sport.swim,

  // --- Športy (Services/sport_type.py ↔ shared/utils/sportMeta.ts) ---
  chartRun: P.sport.run,
  chartStrength: P.sport.strength,
  chartBike: P.sport.ride,
  chartSwim: P.sport.swim,
  chartMixed: P.sport.mixed,
  chartSkate: P.sport.skate,
  chartWalk: P.sport.walk,
  chartOther: P.sport.other,
  chartHike: P.sport.hike,
  chartSoccer: P.sport.soccer,
  chartHiit: P.sport.hiit,
  chartPadel: P.sport.padel,
  chartPickleball: P.sport.pickleball,
  chartBadminton: P.sport.badminton,
  chartYoga: P.sport.yoga,
  chartPilates: P.sport.pilates,
  chartSurfing: P.sport.surfing,
  chartRockClimbing: P.sport.rockClimbing,
  chartAlpineSki: P.sport.alpineSki,

  // --- Úrovne (VO2max, tuk, kondícia); zlé úrovne = statusError ---
  stateExcellent: P.levelExcellent,
  stateSuperior: P.levelSuperior,
  stateGood: P.levelGood,
  stateFair: P.levelFair,
  stateNeutral: P.levelNeutral,
  stateAthletes: P.levelExcellent,
  stateFitness: P.levelSuperior,
  stateAverage: P.levelAverage,

  // --- Fázy plánu ---
  phaseBase: P.phaseBase,
  phaseBuild: P.phaseBuild,
  phaseTaper: P.phaseTaper,
  phasePeak: P.phasePeak,
  phaseRecovery: P.phaseRecovery,

  // --- Panely (tooltip, toast) ---
  panelBg: alpha(P.deep, 0.92),
  panelBorder: P.line,
  panelText: P.text,

  // --- Tiene ---
  shadowSoft: `0 10px 30px ${alpha(P.black, 0.35)}`,
  shadowCard: `0 14px 50px ${alpha(P.black, 0.55)}`,

  // --- Strava (značka, nemení sa s paletou appky) ---
  backgroundStrava: P.strava,
  textStrava: P.white,

  // --- Predplatné ---
  brandFamily: P.tierFamily,
  brandPro: P.tierPro,
  brandClassic: P.tierClassic,
  brandFree: P.tierFree,
} as const;

export type AppColors = typeof appColors;
