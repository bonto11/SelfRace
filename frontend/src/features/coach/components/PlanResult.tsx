"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ───────── helpers ───────── */

type AnyObj = Record<string, any>;

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
function normTarget(it: AnyObj) {
  // tolerantne skúsim viac polí
  return (
    it?.target_pace_min_per_km ??
    it?.target ??
    it?.structure?.main?.[0]?.target?.pace ??
    it?.structure?.main?.target?.pace ??
    null
  );
}
function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;
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
  const parts = [wu, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

function WeekPreview({ lines }: { lines: string[] }) {
  if (!lines?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
      <h3 className="font-semibold mb-1">Weekly preview</h3>
      <ul className="list-disc pl-5 text-sm">
        {lines.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
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

  // 1) Weekly preview (ak poslal model alebo BE)
  const preview: string[] = analysis?.week_overview || analysis?.outline_10w || [];

  // 2) Next 10 days — preferuj new key `next_10_days`, fallback `first_10_days`
  const next10Raw: any[] =
    (Array.isArray(analysis?.next_10_days) && analysis.next_10_days) ||
    (Array.isArray(analysis?.first_10_days) && analysis.first_10_days) ||
    [];

  // 2a) z čoho odvodiť začiatok (pre prípad, že niektorý deň v poli chýba)
  const metaStart: string | null =
    analysis?._meta?.next10_start ||
    (next10Raw.length && typeof next10Raw[0]?.day === "string" ? next10Raw[0].day : null) ||
    null;
  const startDateObj = parseIso(metaStart || undefined);

  // 2b) vyrob “bezpečný” 10-dňový zoznam ISO dátumov
  const safeDates: string[] =
    startDateObj
      ? Array.from({ length: 10 }, (_, i) =>
          toIso(new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate() + i, 12, 0, 0)))
        )
      : [];

  // 2c) pomocné mapovanie day→sessions (ak FE dostane položky s date)
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

      {!!preview.length && <WeekPreview lines={preview} />}

      {/* --- Next 10 days only (no 7-day block) --- */}
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
              return sessions.map((it: AnyObj, sidx: number) => {
                const sport = (detectSport(it) as any) ?? "other";
                return (
                  <ActivitySingle
                    key={`d10-${iso}-${sidx}`}
                    variant="plan"
                    data={{
                      id: `d10-${iso}-${sidx}`,
                      name: normTitle(it),
                      dateIso: iso,
                      sport,
                      planDur: normDuration(it),
                      planIntensity: normIntensity(it),
                      planTarget: normTarget(it),
                      planNotes: normNotes(it),
                      planRaw: it,
                      planStructure: it?.structure ?? null,
                      planExercises: it?.exercises ?? null,
                    }}
                    defaultOpen={false}
                  />
                );
              });
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