"use client";

import type { FC } from "react";

type WeeklyPlanPanelProps = {
  weekly: any | null;
};

const WeeklyPlanPanel: FC<WeeklyPlanPanelProps> = ({ weekly }) => {
  if (!weekly) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm opacity-75">
        Weekly plán ešte nebol vygenerovaný.
      </div>
    );
  }

  // snaž sa nájsť pole týždňov v rôznych formátoch
  let weeks: any[] = [];

  if (Array.isArray(weekly)) {
    weeks = weekly;
  } else if (Array.isArray((weekly as any).weeks)) {
    weeks = (weekly as any).weeks;
  } else if (Array.isArray((weekly as any).weekly_rows)) {
    weeks = (weekly as any).weekly_rows;
  } else if (Array.isArray((weekly as any).data)) {
    weeks = (weekly as any).data;
  }

  const metaModel =
    (weekly as any).model ??
    (weekly as any).ai_model ??
    (weekly as any).llm_model ??
    null;

  if (weeks.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          Weekly plán
        </div>
        <div className="opacity-80">
          API nevrátilo žiadne týždne. Zobrazený je raw JSON:
        </div>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/70 p-2 text-xs text-emerald-100">
          {JSON.stringify(weekly, null, 2)}
        </pre>
      </div>
    );
  }

  // jednoduché agregáty
  let totalMinutes = 0;
  let totalKm = 0;

  weeks.forEach((w) => {
    const m = Number(w.planned_minutes ?? w.week_planned_minutes ?? 0);
    const km = Number(w.planned_km ?? w.week_planned_km ?? 0);
    if (!Number.isNaN(m)) totalMinutes += m;
    if (!Number.isNaN(km)) totalKm += km;
  });

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Weekly coaching plán
          </div>
          <div className="text-base font-semibold text-slate-50">
            {weeks.length} týždňov · ~{Math.round(totalMinutes)} min ·{" "}
            {Math.round(totalKm)} km
          </div>
        </div>
        {metaModel && (
          <div className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
            {metaModel}
          </div>
        )}
      </div>

      {/* zoznam týždňov */}
      <div className="grid gap-3 md:grid-cols-2">
        {weeks.map((w, i) => {
          const idx =
            w.week_index ??
            w.week_idx ??
            (typeof w.index === "number" ? w.index : i + 1);
          const start = w.week_start ?? w.start_date ?? "—";
          const end = w.week_end ?? w.end_date ?? "—";
          const goal = w.goal ?? w.week_goal ?? null;
          const focus = w.focus ?? w.week_focus ?? null;
          const loadPhase = w.load_phase ?? w.phase ?? null;
          const minutes =
            w.planned_minutes ?? w.week_planned_minutes ?? w.total_minutes;
          const km = w.planned_km ?? w.week_planned_km ?? w.total_km;

          return (
            <div
              key={`${idx}-${start}-${i}`}
              className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-100">
                  Týždeň {idx}
                </div>
                <div className="text-xs text-slate-400">
                  {start} – {end}
                </div>
              </div>

              {(goal || focus) && (
                <div className="text-xs text-slate-300 space-x-1">
                  {goal && (
                    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                      {goal}
                    </span>
                  )}
                  {focus && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 capitalize">
                      {focus}
                    </span>
                  )}
                  {loadPhase && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200 capitalize">
                      {loadPhase}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-1 grid grid-cols-3 gap-y-1 text-xs">
                <div className="opacity-70">Minúty</div>
                <div className="col-span-2 font-semibold">
                  {minutes ?? "—"}
                </div>

                <div className="opacity-70">Kilometre</div>
                <div className="col-span-2 font-semibold">
                  {km != null ? km : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyPlanPanel;