export const THEME = {
  color: {
    bgApp: '#0a0a0a',
    bgTopbar: 'rgba(10,10,10,0.9)',
    border: '#27272a',
    text: '#e5e7eb',
    card: '#111827',
    sidebar: '#111111',
    panel: '#1f2937',
  },

  chart: {
    run: '#22D3EE',
    bike: '#A78BFA',
    strength: '#F59E0B',
    mixed: '#34D399',
    skate: '#60A5FA',
    other: '#9CA3AF',
    monotony: '#84CC16',
    strain: '#FDE047',

    grid: 'rgba(255,255,255,0.07)',
    gridSoft: 'rgba(255,255,255,0.05)',
    legendPosition: 'top' as const,

    weeklyHeight: 360,
    weeklyHeightCompact: 180,

    /** NOVÉ: zjednotená šírka stĺpcov a px/label pre detail */
    weeklyBarThickness: 12,
    weeklyPxPerLabel: 56,

    maxBarThickness: 12,
    categoryPercentage: 0.6,
    barPercentage: 0.7,
  },

  mobile: {
    miniWeeks: 2,
    tableMinWidth: 720,
  },
  copy: {
    rotateHint: "Pre detailný graf otočte telefón na šírku.",
  },

  layout: {
    tableMinWidth: 720,
  },

  thresholds: {
    acwr: { ok: [0.8, 1.3] as [number, number], warn: [0.7, 1.5] as [number, number] },
    mono: { ok: [0.8, 1.5] as [number, number], warn: [1.5, 2.0] as [number, number] },
    strn: { ok: [0.8, 1.3] as [number, number], warn: [0.7, 1.6] as [number, number] },
  },

  i18n: {
    dateLocale: 'sk-SK',
    units: { km: 'km', min: 'min', trimp: 'TRIMP' },
  },

  sportLabels: {
    run: "Run",
    bike: "Bike",
    strength: "Strength",
    mixed: "Mixed",
    skate: "Skate",
    walk: "Walk",
    hike: "Hike",
    swim: "Swim",
    other: "Other",
  } as Record<string, string>,
};
