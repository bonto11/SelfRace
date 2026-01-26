export const THEME = {
  color: {
    bgApp:    '#0A0A0A',
    bgTopbar: '#0A0A0AE6', // rgba(10,10,10,0.9)
    border:   '#27272A',
    text:     '#E5E7EB',
    card:     '#111827',
    sidebar:  '#111111',
    panel:    '#1F2937',
  },

  chart: {
    // série
    track:    '#FFFFFF14', // rgba(255,255,255,0.08)
    tick:     '#FFFFFFF2', // rgba(255,255,255,0.95)
    ref80:    '#4ADE8059', // rgba(74,222,128,0.35)
    ref20:    '#F8717159', // rgba(248,113,113,0.35)

    linePrimary: '#FFFFFF', //biela
    lineSecondary: '#FDE047', //zlta
    lineBase: '#4ADE8059',
    bandFill: "rgba(16,185,129,0.15)",
    missing: "#ef4444", // tailwind red-500
    grid:        '#FFFFFF12',
    gridSoft:    '#FFFFFF0D',
    legendPosition: 'top' as const,

    base: "bg-sky-400",
    build: "bg-violet-400",
    peak: "bg-emerald-400",
    recovery: "bg-amber-400",
    default: "bg-slate-400",

    /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */
    weeklyPxPerLabel: 56,

    // výšky
    weeklyHeight: 360,
    weeklyHeightCompact: 180,

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