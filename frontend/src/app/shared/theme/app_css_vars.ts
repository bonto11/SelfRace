// src/shared/theme/app_css_vars.ts
import { appColors } from "./app_colors";

export const APP_CSS_VARS: Record<string, string> = {
  "--app-bg-main": appColors.backgroundMain,
  "--app-bg-alt": appColors.backgroundAlt,

  "--app-surface-card": appColors.surfaceCard,
  "--app-surface-card-hover": appColors.surfaceCardHover,
  "--app-surface-card-border": appColors.surfaceCardBorder,
  "--app-surface-solid": appColors.surfaceSolid,
  "--app-surface-solid-hover": appColors.surfaceSolidHover,

  "--app-divider": appColors.divider,
  "--app-overlay": appColors.overlay,

  "--app-text-primary": appColors.textPrimary,
  "--app-text-secondary": appColors.textSecondary,
  "--app-text-muted": appColors.textMuted,
  "--app-text-inverse": appColors.textInverse,

  "--app-brand-primary": appColors.brandPrimary,
  "--app-brand-secondary": appColors.brandSecondary,
  "--app-brand-muted": appColors.brandMuted,

  "--app-accent-teal": appColors.accentTeal,
  "--app-accent-lime": appColors.accentLime,

  "--app-focus-ring": appColors.focusRing,

  "--app-success": appColors.statusSuccess,
  "--app-warning": appColors.statusWarning,
  "--app-error": appColors.statusError,
  "--app-info": appColors.statusInfo,

  "--app-btn-primary-bg": appColors.buttonPrimaryBg,
  "--app-btn-primary-hover": appColors.buttonPrimaryBgHover,
  "--app-btn-primary-text": appColors.buttonPrimaryText,

  "--app-btn-secondary-bg": appColors.buttonSecondaryBg,
  "--app-btn-secondary-hover": appColors.buttonSecondaryBgHover,
  "--app-btn-secondary-border": appColors.buttonSecondaryBorder,
  "--app-btn-secondary-text": appColors.buttonSecondaryText,

  "--app-btn-ghost-bg": appColors.buttonGhostBg,
  "--app-btn-ghost-hover": appColors.buttonGhostBgHover,
  "--app-btn-ghost-text": appColors.buttonGhostText,

  "--app-btn-danger-bg": appColors.buttonDangerBg,
  "--app-btn-danger-hover": appColors.buttonDangerBgHover,
  "--app-btn-danger-text": appColors.buttonDangerText,

  "--app-pill-bg": appColors.pillBg,
  "--app-pill-hover": appColors.pillBgHover,
  "--app-pill-border": appColors.pillBorder,
  "--app-pill-text": appColors.pillText,
  "--app-pill-active-bg": appColors.pillActiveBg,
  "--app-pill-active-border": appColors.pillActiveBorder,
  "--app-pill-active-text": appColors.pillActiveText,

  "--app-input-bg": appColors.inputBg,
  "--app-input-hover": appColors.inputBgHover,
  "--app-input-border": appColors.inputBorder,
  "--app-input-border-focus": appColors.inputBorderFocus,
  "--app-input-text": appColors.inputText,
  "--app-input-placeholder": appColors.inputPlaceholder,

  "--app-slider-track": appColors.sliderTrack,
  "--app-slider-track-active": appColors.sliderTrackActive,
  "--app-slider-thumb": appColors.sliderThumb,
  "--app-slider-thumb-ring": appColors.sliderThumbRing,

  "--app-chart-1": appColors.chartLine1,
  "--app-chart-2": appColors.chartLine2,
  "--app-chart-3": appColors.chartLine3,
  "--app-chart-4": appColors.chartLine4,
  "--app-chart-grid": appColors.chartGrid,
  "--app-chart-axis": appColors.chartAxis,

  "--app-panel-bg": appColors.panelBg,
  "--app-panel-border": appColors.panelBorder,
  "--app-panel-text": appColors.panelText,
};