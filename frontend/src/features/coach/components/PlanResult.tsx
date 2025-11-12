"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ───────── helpers ───────── */
type AnyObj = Record<string, any>;

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (Array.isArray(hr) && hr.length === 2 && hr.every((x) => Number.isFinite(x))) {
    return `HR ${hr[0]}–${hr[1]}`;
  }
  return null;
}
function paceToText(p?: any): string | null {
  return typeof p === "string" && p.trim() ? `pace ${p}` : null;
}
function powerToText(w?: any): string | null {
  return Number.isFinite(w) ? `power ${w}W` : null;
}

/** vytiahne HR/pace/power – najprv explicitné polia, potom structure.main[0].target */
function normTarget(it: AnyObj): string | null {
  const hr  = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow  = it?.target_power_watts ?? null;

  const mainT =
    Array.isArray(it?.structure?.main)
      ? it.structure.main[0]?.target
      : it?.structure?.main?.target;

  const hr2   = hr ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2  = pow ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** stručný text pre jednoduché intervaly z main / main.sets (ak je) */
function intervalsToText(main: any): string | null {
  const arr =
    Array.isArray(main) ? main : main && Array.isArray(main.sets) ? main.sets : null;
  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec =
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [hrToText(first.target.hr), paceToText(first.target.pace), powerToText(first.target.power)]
        .filter(Boolean)
        .join(" · ")
    : "";
  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean)
    .join(" ");
  return txt || null;
}

function toIso(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function normTitle(it: AnyObj) {
  return it?.title ?? it?.name ?? "Session";
}
function normDuration(it: AnyObj) {
  const minutes =
    (typeof it?.duration_min === "number" && it.duration_min) ??
    (typeof it?.dur === "number" && it.dur) ??
    null;
  return minutes != null ? `${minutes} min` : null;
}
function normIntensity(it: AnyObj) {
  return it?.intensity ?? null;
}
function normNotes(it: AnyObj) {
  // zobrazujeme LEN to, čo prišlo od AI (nepridávame nič vlastné)
  if (it?.notes) return it.notes;

  // ak AI poslalo structure, spravíme len stručný súhrn textom
  const mainTxt = (() => {
    const m = Array.isArray(it?.structure?.main)
      ? it.structure.main[0]
      : it?.structure?.main;
    return m ? intervalsToText(m) : null;
  })();

  const wu = it?.structure?.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : "";
  const cd = it?.structure?.cooldown?.notes ? `CD: ${it.structure.cooldown.notes}` : "";

  const ex =
    Array.isArray(it?.exercises) && it.exercises.length
      ? "Exercises: " +
        it.exercises
          .map((e: any) => {
            const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
            if (e?.seconds) parts.push(`${e.seconds}s`);
            else if (e?.reps) parts.push(`${e.reps}`);
            return parts.filter(Boolean).join(" ");
          })
          .join(", ")
      : "";

  const parts = [mainTxt, wu, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

/* ───────── component ───────── */
export default function PlanResult({
  result,
  showDebugSplit = false,
}: {
  result: any;
  showDebugSplit?: boolean;
}) {
  if (!result) return null;

  const analysis = result?.analysis ?? {};

  // weekly preview – ak model neposlal, zoznam je prázdny (je to v tvojom sample)
  const preview: string[] =
    (Array.isArray(analysis?.week_overview) && analysis.week_overview) ||
    (Array.isArray(analysis?.outline_10w) && analysis.outline_10w) ||
    [];

  // preferuj next_10_days; fallback first_10_days
  const next10Raw: any[] =
    (Array.isArray(analysis?.next_10_days) && analysis.next_10_days) ||
    (Array.isArray(analysis?.first_10_days) && analysis.first_10_days) ||
    [];

  // štart 10-dňovky
  const metaStart: string | null =
    analysis?._meta?.next10_start ||
    (next10Raw.length && typeof next10Raw[0]?.day === "string" ? next10Raw[0].day : null) ||
    null;
  const startDateObj = parseIso(metaStart || undefined);

  // bezpečných 10 dátumov
  const safeDates: string[] = startDateObj
    ? Array.from({ length: 10 }, (_, i) =>
        toIso(
          new Date(
            Date.UTC(
              startDateObj.getUTCFullYear(),
              startDateObj.getUTCMonth(),
              startDateObj.getUTCDate() + i,
              12,
              0,
              0
            )
          )
        )
      )
    : [];

  // mapovanie ISO → sessions
  const byDate: Record<string, any[]> = {};
  for (const entry of next10Raw) {
    if (entry && typeof entry === "object" && typeof entry.day === "string") {
      const d = entry.day;
      const sessions = Array.isArray(entry.sessions)
        ? entry.sessions
        : entry.title
        ? [entry]
        : [];
      byDate[d] = sessions;
    }
  }

  return (
    <div className="space-y-3">
      {result?.narrative && <CoachViewPanel narrative={result.narrative} />}

      {analysis?.summary && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{analysis.summary}</p>
        </div>
      )}

      {!!preview.length && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Weekly preview</h3>
          <ul className="list-disc pl-5 text-sm">
            {preview.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Next 10 days (bez 7-dňového bloku) --- */}
      {safeDates.length > 0 && (
        <section className="rounded-xl border border-white/10 p-3 bg-white/5">
          <h3 className="font-semibold mb-2">Next 10 days</h3>
          <div className="space-y-2">
            {safeDates.map((iso) => {
              const sessions = byDate[iso] || [];
              if (!sessions.length) {
                return (
                  <ActivitySingle
                    key={`d10-${iso}-empty`}
                    variant="plan"
                    data={{
                      id: `d10-${iso}-empty`,
                      name: "—",
                      dateIso: iso,
                      sport: "other",
                      planDur: null,
                      planIntensity: null,
                      planTarget: null,
                      planNotes: null,
                      planRaw: null,
                      planStructure: null,
                      planExercises: null,
                    }}
                    defaultOpen={false}
                  />
                );
              }
              return sessions.map((it: AnyObj, sidx: number) => (
                <ActivitySingle
                  key={`d10-${iso}-${sidx}`}
                  variant="plan"
                  data={{
                    id: `d10-${iso}-${sidx}`,
                    name: it?.title ?? it?.name ?? "Session",
                    dateIso: iso,
                    sport: (detectSport(it) as any) ?? "other",
                    planDur:
                      typeof it?.duration_min === "number" ? `${it.duration_min} min` : null,
                    planIntensity: it?.intensity ?? null,
                    planTarget: normTarget(it), // ← HR/pace/power z AI
                    planNotes: normNotes(it),   // ← text len z AI štruktúry
                    planRaw: it,
                    planStructure: it?.structure ?? null,
                    planExercises: it?.exercises ?? null,
                  }}
                  defaultOpen={false}
                />
              ));
            })}
          </div>
        </section>
      )}

      {showDebugSplit && (
        <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
          {JSON.stringify(analysis, null, 2)}
        </pre>
      )}
    </div>
  );
}