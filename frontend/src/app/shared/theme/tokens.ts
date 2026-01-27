export const THEME = {
  chart: {
    legendPosition: 'top' as const,

    /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */
    weeklyPxPerLabel: 56,

    // výšky
    Height: 360,
    HeightCompact: 180,

    // 🔒 konzistencia barov + vodorovný layout
    bar: {
      maxThickness: 12,
      categoryPct: 0.6,
      barPct: 0.7,
    },
    pxPerLabel: 26,
  },

  mobile: {
    miniWeeks: 2,
    tableMinWidth: 720,
  },
  copy: {
    rotateHint: 'Pre detailný graf otočte telefón na šírku.',
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
    run: 'Run',
    bike: 'Bike',
    strength: 'Strength',
    mixed: 'Mixed',
    skate: 'Skate',
    walk: 'Walk',
    hike: 'Hike',
    swim: 'Swim',
    other: 'Other',
  } as Record<string, string>,

  weekLabels: {
    base: 'Base (budovanie základu)',
    build: 'Build (zvyšovanie intenzity)',
    peak: 'Peak (vrchol / preteky)',
    recovery: 'Recovery (regenerácia)',
    default: 'Iné / mix',
  }
};