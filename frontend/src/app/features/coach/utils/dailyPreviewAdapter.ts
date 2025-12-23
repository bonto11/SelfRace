// src/features/coach/utils/dailyPreviewAdapter.ts

export function buildDailyAnalysisFromPlan(resp: any): {
  analysis: any;
  meta: any;
} {
  const daily = resp?.daily_plan ?? resp ?? {};
  const days: any[] = Array.isArray(daily.days) ? daily.days : [];

  // next_10_days pre PlanPreview / apiSaveActivePlan
  const next_10_days = days.slice(0, 10).map((d) => ({
    day: d.date,
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
  }));

  // jednoduché summary
  let totalMin = 0;
  let sessionsCount = 0;
  let runSessions = 0;
  let strengthSessions = 0;

  for (const d of days) {
    const sessions = Array.isArray(d.sessions) ? d.sessions : [];
    for (const s of sessions) {
      sessionsCount += 1;
      const dur = Number(s?.duration_min || 0);
      totalMin += dur;
      const sport = String(s?.sport || "").toLowerCase();
      if (sport === "run") runSessions += 1;
      if (sport === "strength") strengthSessions += 1;
    }
  }

  const totalHours = totalMin / 60;
  const summary = `AI týždeň ${daily.week_index ?? "?"}: ${sessionsCount} tréningov (~${totalHours.toFixed(
    1
  )} h). Beh: ${runSessions}×, sila: ${strengthSessions}×.`;

  const analysis = {
    schema_version: daily.schema_version ?? 1,
    generated_at: daily.generated_at ?? null,
    model: daily.model ?? "Trainalyze Coach",
    summary,
    next_10_days,
    insights: [] as string[],
  };

  const meta = {
    source: "daily_v1",
    week_index: daily.week_index ?? null,
    week_start: daily.week_start ?? null,
    week_end: daily.week_end ?? null,
  };

  return { analysis, meta };
}