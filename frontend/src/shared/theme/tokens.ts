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
    run:      '#22C55E',
    ride:     '#38BDF8',
    bike:     '#38BDF8',
    swim:     '#60A5FA',
    strength: '#F59E0B',
    mixed:    '#A78BFA',
    skate:    '#F472B6',
    hike:     '#34D399',
    walk:     '#9CA3AF',
    other:    '#94A3B8',

    monotony: '#84CC16',
    strain:   '#FDE047',

    easy80:   '#00E676',
    hard20:   '#FF5252',
    track:    '#FFFFFF14', // rgba(255,255,255,0.08)
    tick:     '#FFFFFFF2', // rgba(255,255,255,0.95)
    ref80:    '#4ADE8059', // rgba(74,222,128,0.35)
    ref20:    '#F8717159', // rgba(248,113,113,0.35)

    // lepšie oddelené pásma (čisto HEX)
    excellent : '#16A34A', // green-600 (naj "zelenejšia")
    superior  : '#14B8A6', // teal-500 (ostal tyrkys)
    good      : '#22C55E', // emerald-500
    average      : '#F59E0B', // emerald-500
    fair      : '#F59E0B', // sky-400 (naša bežná modrá)
    poor      : '#EF4444', // amber-500 (oranžová)
    neutral   : '#64748B', // sivá, beží ďalej

    athletes : '#16A34A', // green-600 (naj "zelenejšia")
    fitness  : '#14B8A6', // teal-500 (ostal tyrkys)
    essential      : '#EF4444', // cervena
    obese      : '#EF4444', // cervena

    linePrimary: '#22C55E',

    grid:        '#FFFFFF12', // rgba(255,255,255,0.07)
    gridSoft:    '#FFFFFF0D', // rgba(255,255,255,0.05)
    legendPosition: 'top' as const,

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
};