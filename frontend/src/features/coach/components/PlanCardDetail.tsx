// src/features/coach/components/PlanCardDetail.tsx
"use client";

export default function PlanCardDetail({ s }: { s: any }) {
  if (!s || typeof s !== "object") return null;

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="text-sm">{children}</div>
  );

  const Target = ({ t }: { t?: any }) => {
    if (!t) return null;
    const bits: string[] = [];
    if (t.pace) bits.push(`pace ${t.pace}/km`);
    if (Array.isArray(t.hr) && t.hr.length === 2) bits.push(`HR ${t.hr[0]}–${t.hr[1]} bpm`);
    if (t.power) bits.push(`${t.power} W`);
    if (t.zone) bits.push(t.zone);
    return bits.length ? <span className="opacity-80"> — {bits.join(" · ")}</span> : null;
  };

  return (
    <div className="mt-2 rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
      {s.warmup && (
        <Row>
          <b>WU:</b> {s.warmup.minutes}′{s.warmup.notes ? ` — ${s.warmup.notes}` : ""}
          <Target t={s.warmup.target} />
        </Row>
      )}

      {Array.isArray(s.main) && s.main.length > 0 && (
        <div className="mt-1">
          <div className="text-sm font-semibold">Main</div>
          <ul className="list-disc pl-5 text-sm">
            {s.main.map((b: any, i: number) => (
              <li key={i}>
                {b.reps ? `${b.reps}×` : ""}{b.work_min}′
                {b.recover_min != null ? ` / ${b.recover_min}′` : ""}
                {b.recovery_mode ? ` (${b.recovery_mode})` : ""}
                <Target t={b.target} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.cooldown && (
        <Row>
          <b>CD:</b> {s.cooldown.minutes}′{s.cooldown.notes ? ` — ${s.cooldown.notes}` : ""}
        </Row>
      )}

      {Array.isArray(s.exercises) && s.exercises.length > 0 && (
        <div className="mt-1">
          <div className="text-sm font-semibold">Exercises</div>
          <ul className="list-disc pl-5 text-sm">
            {s.exercises.map((e: any, i: number) => (
              <li key={i}>
                <b>{e.name}</b> — {e.sets}×{e.reps}
                {e.tempo ? ` · tempo ${e.tempo}` : ""}
                {e.rest_sec ? ` · rest ${e.rest_sec}s` : ""}
                {e.focus ? ` · ${e.focus}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}