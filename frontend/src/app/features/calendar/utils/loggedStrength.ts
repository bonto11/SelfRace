// src/app/features/calendar/utils/loggedStrength.ts
import type { StrengthSession } from "@/app/features/strength/api/strength_sessions";

/** Odcvičený ručný zápis silového tréningu – do kalendára. */
export type LoggedStrength = {
  id: number;
  date: string;
  title: string | null;
  planSessionId: number | null;
  exercises: number;
  sets: number;
};

/**
 * Zápisy, ktoré sa v kalendári ukážu: aspoň jedna odcvičená séria (prázdny
 * zápis po ťuknutí na „Zapísať“ nie je tréning) a bez spárovanej Strava
 * aktivity – tá je v kalendári už sama za seba.
 *
 * PREČO: kto posilňuje bez Stravy, mal kalendár prázdny, hoci trénoval.
 * Zápis naviazaný na plán robí z plánu ✓ (BE nastaví status „done“, FE
 * to vie aj skôr, kým sa plán neobnoví), voľný zápis je ● ako aktivita.
 */
export function loggedStrengthSessions(sessions: StrengthSession[] | undefined): LoggedStrength[] {
  const out: LoggedStrength[] = [];
  for (const s of sessions ?? []) {
    if (s.activity_id != null) continue;
    let exercises = 0;
    let sets = 0;
    for (const ex of s.log?.exercises ?? []) {
      const done = (ex.sets ?? []).filter((x) => !x.is_warmup && !!x.reps).length;
      if (done) {
        exercises += 1;
        sets += done;
      }
    }
    if (!sets) continue;
    out.push({
      id: s.id,
      date: String(s.session_date ?? "").slice(0, 10),
      title: s.title ?? null,
      planSessionId: s.plan_session_id ?? null,
      exercises,
      sets,
    });
  }
  return out;
}

/** Id plánov, ktoré sú splnené zápisom silového tréningu. */
export function loggedPlanIds(logged: LoggedStrength[]): Set<number> {
  return new Set(logged.filter((l) => l.planSessionId != null).map((l) => Number(l.planSessionId)));
}
