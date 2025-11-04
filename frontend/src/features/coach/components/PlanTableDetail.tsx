// src/features/coach/components/PlanTableDetail.tsx
"use client";

import { SUBCARD } from "@/shared/ui/classes";

function TargetBadge({ t }: { t?: any }) {
  if (!t) return null;
  const bits: string[] = [];
  if (t.pace) bits.push(`pace ${t.pace}/km`);
  if (Array.isArray(t.hr) && t.hr.length === 2) bits.push(`HR ${t.hr[0]}–${t.hr[1]} bpm`);
  if (t.power) bits.push(`${t.power} W`);
  if (t.zone) bits.push(t.zone);
  return bits.length ? <span className="opacity-80"> — {bits.join(" · ")}</span> : null;
}

export default function PlanTableDetail({ s }: { s: any }) {
  if (!s || typeof s !== "object") return null;
  return (
    <div className={`${SUBCARD}`}>
      <div className="space-y-2 text-sm">
        {s.warmup && (
          <div>
            <b>Warm-up:</b> {s.warmup.minutes}′
            {s.warmup.notes ? ` — ${s.warmup.notes}` : ""}
            <TargetBadge t={s.warmup.target} />
          </div>
        )}

        {Array.isArray(s.main) && s.main.length > 0 && (
          <div>
            <b>Main:</b>
            <ul className="list-disc pl-5 mt-1">
              {s.main.map((b: any, i: number) => (
                <li key={i}>
                  {b.reps ? `${b.reps}×` : ""}{b.work_min}′
                  {b.recover_min != null ? ` / ${b.recover_min}′` : ""}
                  {b.recovery_mode ? ` (${b.recovery_mode})` : ""}
                  <TargetBadge t={b.target} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.cooldown && (
          <div>
            <b>Cool-down:</b> {s.cooldown.minutes}′
            {s.cooldown.notes ? ` — ${s.cooldown.notes}` : ""}
          </div>
        )}

        {Array.isArray(s.exercises) && s.exercises.length > 0 && (
          <div>
            <b>Exercises:</b>
            <ul className="list-disc pl-5 mt-1">
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
    </div>
  );
}