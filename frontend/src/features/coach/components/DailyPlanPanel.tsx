"use client";

import type { FC } from "react";

type DailyPlanPanelProps = {
  daily: any | null;
};

const DailyPlanPanel: FC<DailyPlanPanelProps> = ({ daily }) => {
  if (!daily) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm opacity-75">
        Daily plán ešte nebol vygenerovaný.
      </div>
    );
  }

  // API môže vracať { success, daily_plan, ... } alebo rovno objekt s days
  const plan = (daily as any).daily_plan ?? daily;
  const days: any[] = Array.isArray(plan.days) ? plan.days : [];

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          Daily plán
        </div>
        <div className="opacity-80">
          Nenašli sa žiadne dni. Zobrazený je raw JSON:
        </div>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/70 p-2 text-xs text-emerald-100">
          {JSON.stringify(daily, null, 2)}
        </pre>
      </div>
    );
  }

  const model =
    plan.model ?? (daily as any).model ?? (daily as any).ai_model ?? null;
  const generatedAt = plan.generated_at ?? null;
  const weekIdx = plan.week_index ?? null;
  const weekStart = plan.week_start ?? null;
  const weekEnd = plan.week_end ?? null;

  // helper na sumarizáciu jedného dňa
  function summarizeDay(day: any) {
    const sessions: any[] = Array.isArray(day.sessions) ? day.sessions : [];
    let totalMin = 0;
    let hardCnt = 0;
    let strengthCnt = 0;

    const tags: string[] = [];

    sessions.forEach((s) => {
      const dur = Number(s.duration_min ?? 0);
      if (!Number.isNaN(dur)) totalMin += dur;

      const sport = s.sport ?? "other";
      const intensity = (s.intensity ?? "").toLowerCase();

      if (sport === "strength") strengthCnt += 1;
      if (intensity === "hard" || intensity === "moderate") hardCnt += 1;
    });

    if (hardCnt > 0) tags.push(`${hardCnt}× hard`);
    if (strengthCnt > 0) tags.push(`${strengthCnt}× strength`);

    return { totalMin, hardCnt, strengthCnt, tags, sessions };
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Daily plán – rozpis tréningov
          </div>
          <div className="text-base font-semibold text-slate-50">
            {days.length} dní
            {weekIdx != null && <> · týždeň {weekIdx}</>}
          </div>
          {weekStart && weekEnd && (
            <div className="text-xs text-slate-400">
              {weekStart} – {weekEnd}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
          {generatedAt && (
            <div>
              Generated:&nbsp;
              <span className="font-semibold text-slate-200">
                {generatedAt}
              </span>
            </div>
          )}
          {model && (
            <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
              {model}
            </div>
          )}
        </div>
      </div>

      {/* dni v jednom stĺpci (timeline-like) */}
      <div className="space-y-3">
        {days.map((day, idx) => {
          const date = day.date ?? "—";
          const { totalMin, tags, sessions } = summarizeDay(day);

          return (
            <div
              key={`${date}-${idx}`}
              className="relative rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Deň {idx + 1}
                  </div>
                  <div className="text-base font-semibold text-slate-50">
                    {date}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <div className="font-semibold">{totalMin} min</div>
                  {tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      {tags.map((t, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* jednotlivé sessions */}
              <div className="mt-2 space-y-1.5">
                {sessions.map((s, i) => {
                  const sport = s.sport ?? "other";
                  const title = s.title ?? "Bez názvu";
                  const dur = s.duration_min ?? null;
                  const intensity = s.intensity ?? null;
                  const sessionType = s.session_type ?? null;
                  const zoneText = s.zone_text ?? null;

                  const isStrength = sport === "strength";
                  const hasStrengthSlots =
                    !!s.structure?.strength_exercises &&
                    Array.isArray(s.structure.strength_exercises) &&
                    s.structure.strength_exercises.length > 0;

                  return (
                    <div
                      key={i}
                      className="rounded-md bg-slate-900/50 px-2 py-1.5 text-xs border border-white/5"
                    >
                      <div className="flex justify-between gap-2">
                        <div className="font-semibold text-slate-100">
                          {title}
                        </div>
                        {dur != null && (
                          <div className="text-slate-300">{dur} min</div>
                        )}
                      </div>

                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-slate-300">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                          {sport}
                        </span>
                        {sessionType && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                            {sessionType}
                          </span>
                        )}
                        {intensity && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                            {intensity}
                          </span>
                        )}
                        {zoneText && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5">
                            {zoneText}
                          </span>
                        )}
                        {isStrength && hasStrengthSlots && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                            {s.structure.strength_exercises.length} cvikov
                          </span>
                        )}
                      </div>

                      {s.notes && (
                        <p className="mt-1 text-[11px] text-slate-200 opacity-90">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyPlanPanel;