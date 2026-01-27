export const OPTIONS = {
  legendPosition: "top" as const,

  weeklyPxPerLabel: 56 /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */,

  Height: 360,
  HeightCompact: 180,

  bar: {
    maxThickness: 12,
    categoryPct: 0.6,
    barPct: 0.7,
  },
  pxPerLabel: 26, // 🔒 konzistencia barov + vodorovný layout
};

export const WEEK_OPTIONS = [
  { value: "2", label: "2 týždne" },
  { value: "4", label: "4 týždne" },
  { value: "8", label: "8 týždňov" },
  { value: "12", label: "12 týždňov" },
];
