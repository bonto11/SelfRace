// src/features/calendar/utils/calendarSlots.ts

export type CalendarItemKind =
  | "activity"
  | "external"
  | "plan"
  | "done"
  | "missed";

export type CalendarItemBase = {
  sport: string;
  kind: CalendarItemKind;
  /** ID Strava aktivity, ak nejaký existuje (napr. pri 'activity' alebo 'done') */
  activityId?: number | null;
};

/**
 * Robustne vytiahne dátum vo forme YYYY-MM-DD z rôznych event/plan objektov.
 * Podporuje:
 * - external events: occurrence_date / single_date
 * - plánované tréningy: plan_date
 * - aktivity: date / start_date
 */
export function eventDateIso(ev: any): string | null {
  const raw =
    ev?.occurrence_date ??
    ev?.plan_date ??
    ev?.single_date ??
    ev?.date ??
    ev?.start_date ??
    null;

  if (!raw) return null;
  const s = String(raw);
  if (s.length < 10) return null;
  return s.slice(0, 10);
}

/**
 * Dedupe logika pre jeden deň:
 *
 * 1) DONE vs ACTIVITY podľa activityId:
 *    - ak existuje DONE s konkrétnym activityId → skry čistú ACTIVITY s rovnakým activityId
 *
 * 2) Podľa športu:
 *    - ak pre šport existuje ACTIVITY/DONE → skry PLAN/MISSED/EXTERNAL pre ten šport
 *    - ak neexistuje ACTIVITY/DONE, ale existuje PLAN/MISSED → skry EXTERNAL pre ten šport
 */
export function dedupeCalendarItems<T extends CalendarItemBase>(items: T[]): T[] {
  if (!items.length) return items;

  // 1) DONE vs ACTIVITY podľa activityId
  const doneIds = new Set<number>();
  for (const it of items) {
    if (
      it.kind === "done" &&
      it.activityId != null &&
      !Number.isNaN(Number(it.activityId))
    ) {
      doneIds.add(Number(it.activityId));
    }
  }

  let out = items.filter((it) => {
    if (
      it.kind === "activity" &&
      it.activityId != null &&
      !Number.isNaN(Number(it.activityId)) &&
      doneIds.has(Number(it.activityId))
    ) {
      // máme DONE pre tú istú aktivitu → activity bodku skryjeme
      return false;
    }
    return true;
  });

  // 2) športová dedupe logika (rovnaká pre kalendár aj widget)
  const hasActivityOrDone = new Set(
    out
      .filter((x) => x.kind === "activity" || x.kind === "done")
      .map((x) => x.sport)
  );

  const hasPlanOrMissed = new Set(
    out
      .filter((x) => x.kind === "plan" || x.kind === "missed")
      .map((x) => x.sport)
  );

  if (!hasActivityOrDone.size && !hasPlanOrMissed.size) {
    return out;
  }

  out = out.filter((x) => {
    const sport = x.sport;

    // a) ak existuje activity/done pre šport → nechaj len activity/done
    if (hasActivityOrDone.has(sport)) {
      return x.kind === "activity" || x.kind === "done";
    }

    // b) ak nie je activity/done, ale je plan/missed → skry external
    if (hasPlanOrMissed.has(sport) && x.kind === "external") {
      return false;
    }

    return true;
  });

  return out;
}