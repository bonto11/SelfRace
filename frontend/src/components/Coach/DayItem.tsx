"use client";

type Target = {
  pace?: string | null;         // "4:35–4:45"
  hr?: number[] | null;         // [150,165]
  power?: number | null;        // 250
  zone?: string | null;         // "Z3 (LT)"
};

function TargetBadge({ pace, hr, power, zone }: Target) {
  const bits: string[] = [];
  if (pace) bits.push(`pace ${pace}/km`);
  if (hr && hr.length === 2) bits.push(`HR ${hr[0]}–${hr[1]} bpm`);
  if (power) bits.push(`${power} W`);
  if (zone) bits.push(zone);
  return bits.length ? <span className="text-xs opacity-80"> — {bits.join(" · ")}</span> : null;
}

function Structure({ s }: { s: any }) {
  if (!s || typeof s !== "object") return null;
  return (
    <div className="mt-1 space-y-1 text-xs">
      {s.warmup && (
        <div>
          WU {s.warmup.minutes}′{s.warmup.notes ? ` — ${s.warmup.notes}` : ""}
          <TargetBadge pace={s.warmup?.target?.pace} hr={s.warmup?.target?.hr} zone={s.warmup?.target?.zone} />
        </div>
      )}

      {Array.isArray(s.main) && s.main.length > 0 && (
        <div>
          MAIN
          <ul className="list-disc pl-5">
            {s.main.map((b: any, i: number) => (
              <li key={i}>
                {b.reps}×{b.work_min}′ / {b.recover_min}′ {b.recovery_mode ? `(${b.recovery_mode})` : ""}
                <TargetBadge pace={b.target?.pace} hr={b.target?.hr} power={b.target?.power} zone={b.target?.zone} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.cooldown && <div>CD {s.cooldown.minutes}′{s.cooldown.notes ? ` — ${s.cooldown.notes}` : ""}</div>}

      {Array.isArray(s.exercises) && s.exercises.length > 0 && (
        <div>
          Exercises
          <ul className="list-disc pl-5">
            {s.exercises.map((e: any, i: number) => (
              <li key={i}>
                <b>{e.name}</b> — {e.sets}×{e.reps}
                {e.tempo ? ` · tempo ${e.tempo}` : ""}{e.rest_sec ? ` · rest ${e.rest_sec}s` : ""}{e.focus ? ` · ${e.focus}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DayItem({ it }: { it: any }) {
  if (!it || typeof it !== "object") return null;
  const title = it.title || it.activity || "Session";
  const dur = it.duration_min ?? it.duration ?? null;
  const intensity = it.intensity || it.zone || null;
  return (
    <li className="text-sm">
      <b>{title}</b>
      {dur ? <> — {dur} min</> : null}
      {intensity ? <> ({intensity})</> : null}

      <TargetBadge
        pace={it.target_pace_min_per_km}
        hr={it.target_hr_bpm_range}
        power={it.target_power_watts}
        zone={it.zone}
      />
      <Structure s={it.structure} />
      {it.notes ? <div className="text-xs opacity-80 mt-1">{it.notes}</div> : null}
    </li>
  );
}