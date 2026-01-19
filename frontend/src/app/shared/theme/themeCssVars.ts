// src/shared/theme/themeCssVars.ts
import { appColors } from "./app_colors";

type CssVarMap = Record<string, string>;

export const THEME_VARS: CssVarMap = {
  // Core
  "--app-bg": appColors.backgroundMain,
  "--app-bg-alt": appColors.backgroundAlt,

  // Surfaces
  "--app-surface-card": appColors.surfaceCard,
  "--app-surface-card-hover": appColors.surfaceCardHover,
  "--app-surface-card-border": appColors.surfaceCardBorder,
  "--app-surface-solid": appColors.surfaceSolid,
  "--app-surface-solid-hover": appColors.surfaceSolidHover,

  // Text
  "--app-text": appColors.textPrimary,
  "--app-text-secondary": appColors.textSecondary,
  "--app-text-muted": appColors.textMuted,
  "--app-text-inverse": appColors.textInverse,

  // Brand / accents
  "--app-brand": appColors.brandPrimary,
  "--app-brand-2": appColors.brandSecondary,
  "--app-accent-teal": appColors.accentTeal,
  "--app-accent-lime": appColors.accentLime,

  // Status
  "--app-success": appColors.statusSuccess,
  "--app-warning": appColors.statusWarning,
  "--app-danger": appColors.statusError,
  "--app-info": appColors.statusInfo,

  // Focus
  "--app-ring": appColors.focusRing,

  // Inputs
  "--app-input-bg": appColors.inputBg,
  "--app-input-bg-hover": appColors.inputBgHover,
  "--app-input-border": appColors.inputBorder,
  "--app-input-border-focus": appColors.inputBorderFocus,
  "--app-input-placeholder": appColors.inputPlaceholder,

  // Buttons
  "--app-btn-primary-bg": appColors.buttonPrimaryBg,
  "--app-btn-primary-bg-hover": appColors.buttonPrimaryBgHover,
  "--app-btn-primary-text": appColors.buttonPrimaryText,

  "--app-btn-secondary-bg": appColors.buttonSecondaryBg,
  "--app-btn-secondary-bg-hover": appColors.buttonSecondaryBgHover,
  "--app-btn-secondary-border": appColors.buttonSecondaryBorder,
  "--app-btn-secondary-text": appColors.buttonSecondaryText,

  "--app-btn-ghost-bg": appColors.buttonGhostBg,
  "--app-btn-ghost-bg-hover": appColors.buttonGhostBgHover,
  "--app-btn-ghost-text": appColors.buttonGhostText,

  "--app-btn-danger-bg": appColors.buttonDangerBg,
  "--app-btn-danger-bg-hover": appColors.buttonDangerBgHover,
  "--app-btn-danger-text": appColors.buttonDangerText,

  // Pills
  "--app-pill-bg": appColors.pillBg,
  "--app-pill-bg-hover": appColors.pillBgHover,
  "--app-pill-border": appColors.pillBorder,
  "--app-pill-text": appColors.pillText,
  "--app-pill-active-bg": appColors.pillActiveBg,
  "--app-pill-active-border": appColors.pillActiveBorder,
  "--app-pill-active-text": appColors.pillActiveText,

  // Slider
  "--app-slider-track": appColors.sliderTrack,
  "--app-slider-track-active": appColors.sliderTrackActive,
  "--app-slider-thumb": appColors.sliderThumb,
  "--app-slider-thumb-ring": appColors.sliderThumbRing,

  // Charts
  "--app-chart-1": appColors.chartLine1,
  "--app-chart-2": appColors.chartLine2,
  "--app-chart-3": appColors.chartLine3,
  "--app-chart-4": appColors.chartLine4,
  "--app-chart-grid": appColors.chartGrid,
  "--app-chart-axis": appColors.chartAxis,

  // Panels
  "--app-panel-bg": appColors.panelBg,
  "--app-panel-border": appColors.panelBorder,
  "--app-panel-text": appColors.panelText,

  // Misc
  "--app-divider": appColors.divider,
  "--app-overlay": appColors.overlay,

  // Shadows (tie sú tiež “farby/tokens” u teba, nech idú cez vars)
  "--app-shadow-soft": appColors.shadowSoft,
  "--app-shadow-card": appColors.shadowCard,
};

export function toCssVars(vars: CssVarMap): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}