// src/shared/theme/tokens.ts
export const THEME = {
  color: {
    bgApp:    '#0a0a0a',
    bgTopbar: 'rgba(10,10,10,0.9)',
    border:   '#27272a',
    text:     '#e5e7eb',
    card:     '#111827',
    sidebar:  '#111111',
    panel:    '#1f2937',
  },
  chart: {
    run:      '#22D3EE',
    bike:     '#A78BFA',
    strength: '#F59E0B',
    mixed:    '#34D399',
    skate:    '#60A5FA',
    other:    '#9CA3AF',
    monotony: '#84CC16',
    strain:   '#FDE047',
    grid:     'rgba(255,255,255,0.07)',
    gridSoft: 'rgba(255,255,255,0.05)',
    legendPosition: 'top' as const,
  },
};
