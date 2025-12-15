export const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

export function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

// Po = 0 .. Ne = 6
export const startWeekday = (y: number, m0: number) =>
  (new Date(y, m0, 1).getDay() + 6) % 7;

export function gridRange42(year: number, month0: number) {
  const offset = startWeekday(year, month0);
  const firstCell = new Date(year, month0, 1 - offset);
  const lastCell = new Date(firstCell);
  lastCell.setDate(firstCell.getDate() + 41);

  const fromIso = iso(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate());
  const toIso = iso(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate());
  return { fromIso, toIso };
}