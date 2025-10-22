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
    // série
    run: '#22D3EE',
    bike: '#A78BFA',
    strength: '#F59E0B',
    mixed: '#34D399',
    skate: '#60A5FA',
    other: '#9CA3AF',
    monotony: '#84CC16',
    strain: '#FDE047',

    easy80: "#00E676",
    hard20: "#FF5252",
    track: "rgba(255,255,255,0.08)",
    tick:  "rgba(255,255,255,0.95)",

    grid: 'rgba(255,255,255,0.07)',
    gridSoft: 'rgba(255,255,255,0.05)',
    legendPosition: 'top' as const,

    /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */
    weeklyPxPerLabel: 56,
    
    // výšky
    weeklyHeight: 360,
    weeklyHeightCompact: 180,

    // 🔒 konzistencia barov + vodorovný layout
    bar: {
      maxThickness: 12,      // rovnaké ako vo widgetoch
      categoryPct: 0.6,
      barPct: 0.7,
    },
    pxPerLabel: 26,          // šírka 1 týždňa (rovnaké ako widget)
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
