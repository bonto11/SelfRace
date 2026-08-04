export type WeekdayInt = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Mon ... 7=Sun
export type DayAbbrev = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DAY_TO_INT: Record<DayAbbrev, WeekdayInt> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export const INT_TO_DAY: Record<WeekdayInt, DayAbbrev> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

// JS Date.getDay(): 0=Sun..6=Sat
export const JS_TO_DAY: DayAbbrev[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function niceLabelForDay(d: DayAbbrev): string {
  switch (d) {
    case "Mon":
      return "Po";
    case "Tue":
      return "Ut";
    case "Wed":
      return "St";
    case "Thu":
      return "Št";
    case "Fri":
      return "Pi";
    case "Sat":
      return "So";
    case "Sun":
      return "Ne";
    default:
      return d;
  }
}

/**
 * Robustný parser: podporí number aj stringy (wed, Wed, wednesday, streda, ...).
 * Vracia 1..7 alebo null.
 */
export function normalizeWeekdayToInt(x: unknown): WeekdayInt | null {
  // number case
  if (typeof x === "number" && Number.isFinite(x)) {
    const n = Math.trunc(x);
    if (n >= 1 && n <= 7) return n as WeekdayInt;
    return null;
  }

  // string case
  const s = typeof x === "string" ? x.trim().toLowerCase() : "";
  if (!s) return null;

  // numeric string
  if (/^[1-7]$/.test(s)) return Number(s) as WeekdayInt;

  // english short
  if (s === "mon") return 1;
  if (s === "tue" || s === "tues") return 2;
  if (s === "wed") return 3;
  if (s === "thu" || s === "thur" || s === "thurs") return 4;
  if (s === "fri") return 5;
  if (s === "sat") return 6;
  if (s === "sun") return 7;

  // english full
  if (s === "monday") return 1;
  if (s === "tuesday") return 2;
  if (s === "wednesday") return 3;
  if (s === "thursday") return 4;
  if (s === "friday") return 5;
  if (s === "saturday") return 6;
  if (s === "sunday") return 7;

  // slovak (bez diakritiky aj s)
  if (s === "pondelok") return 1;
  if (s === "utorok") return 2;
  if (s === "streda") return 3;
  if (s === "stvrtok" || s === "štvrtok") return 4;
  if (s === "piatok") return 5;
  if (s === "sobota") return 6;
  if (s === "nedela" || s === "nedeľa") return 7;

  return null;
}