// src/shared/theme/tokens.ts
export const THEME = {
  // ===== farby UI =====
  color: {
    bgApp:    '#0a0a0a',
    bgTopbar: 'rgba(10,10,10,0.9)',
    border:   '#27272a',
    text:     '#e5e7eb',
    card:     '#111827',
    sidebar:  '#111111',
    panel:    '#1f2937',
  },

  // ===== grafy =====
  chart: {
    // farby sérií
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

    // fix výšky grafov podľa breakpointov (používa ChartContainer)
    height: { sm: 256, md: 288, lg: 360, xl: 420 },
    weeklyHeight: 360,       // default desktop výška
    weeklyHeightCompact: 180, // mini výška v mobile

    // NOVÉ: horizontálna mierka a limit videných týždňov na šírku
    weekPx: 44,              // px šírka jedného týždňa
    maxWeeksPerViewport: 8,  // koľko týždňov sa zmestí bez scrollu v landscape
  
  },
  
  // ===== “obsahové” konštanty =====
  mobile: {
    miniWeeks: 2,            // koľko týždňov ukázať v "mini" grafe
    tableMinWidth: 720       // šírka „full“ grafu/table pre horizontálny scroll
  },
  copy: {
    rotateHint: "Pre detailný graf otočte telefón na šírku."
  },


  // ===== tabuľky / layout =====
  layout: {
    tableMinWidth: 720,      // px, aby tabuľky nerozťahovali layout
  },

  // ===== KPI prahy (WeeklySummary) =====
  thresholds: {
    acwr: { ok: [0.8, 1.3] as [number, number], warn: [0.7, 1.5] as [number, number] },
    mono: { ok: [0.8, 1.5] as [number, number], warn: [1.5, 2.0] as [number, number] },
    strn: { ok: [0.8, 1.3] as [number, number], warn: [0.7, 1.6] as [number, number] },
  },

  // ===== “obsahové” konštanty =====
  i18n: {
    dateLocale: 'sk-SK',
    units: { km: 'km', min: 'min', trimp: 'TRIMP' },
  },

  
  // ===== športové labely (centrálne) =====
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
