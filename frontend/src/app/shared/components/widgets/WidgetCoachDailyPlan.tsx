// src/shared/components/widgets/WidgetCoachDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_SUB,
  WIDGET_INFO_TEXT,
  WIDGET_EMPTY_TEXT,
  WIDGET_KV_GRID,
  WIDGET_KV_LABEL,
  WIDGET_KV_VALUE,
  WIDGET_SUMMARY_WRAP,
  WIDGET_SUMMARY_HEAD,
  WIDGET_LIST,
  WIDGET_LIST_ITEM,
  WIDGET_BULLET,
  WIDGET_MORE_HINT,
  WIDGET_TRUNCATE,
} from "@/app/shared/ui/tokens";

import {
  apiGetDailyOverview,
  type DailyOverview,
  type DailyPlanDay,
} from "@/app/features/coach/api/coach_plan_daily";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  horizonDays: number;
  daysCount: number;
  sessionsCount: number;
  todayLabel: string | null;
  todaySessions: DailyPlanDay["sessions"] | null;
};

const TOOLTIP_COACH_DAILY = [
  "Daily plan je konkrétny „rozpis dní“ pre najbližšie obdobie (zvyčajne 1–2 týždne dopredu).",
  "",
  "Čo tu vidíš:",
  "• Počet dní – koľko dní ti vieme z DB zobraziť (napr. 7 alebo 14).",
  "• Počet tréningov – počet session blokov v tomto horizonte (môže byť aj viac blokov za deň).",
  "• Dnešok / najbližší deň – ak dnes nie je v pláne (napr. plán začína zajtra), zobrazí sa prvý dostupný deň.",
  "",
  "Ako to používať prakticky:",
  "• Ráno rýchlo skontroluješ „čo je dnes“ bez toho, aby si otváral detail.",
  "• Ak vidíš viac blokov v deň, typicky ide o kombináciu: hlavný tréning + doplnok (mobilita/strength/rehab/kompenzácie).",
  "",
  "Čo to NIE je:",
  "• Nie je to realtime adaptácia počas dňa. Adaptácia sa robí cez nové AI generovanie/refresh (podľa toho, ako to máš navrhnuté).",
  "",
  "Tipy pre konzistenciu:",
  "• Keď zmeníš preferencie (goal, weeks, športy) alebo pribudne veľa nových aktivít, má zmysel vygenerovať nový daily plán, aby zodpovedal realite.",
].join("\n");

function buildUiState(overview: DailyOverview | null): UiState {
  if (!overview || !overview.days?.length) {
    return {
      horizonDays: 0,
      daysCount: 0,
      sessionsCount: 0,
      todayLabel: null,
      todaySessions: null,
    };
  }

  const days = overview.days;
  const daysCount = days.length;

  let sessionsCount = 0;
  for (const d of days) sessionsCount += d.sessions?.length ?? 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = days.find((d) => d.date === todayStr) ?? days[0];

  return {
    horizonDays: overview.horizon_days ?? daysCount,
    daysCount,
    sessionsCount,
    todayLabel: todayDay?.date ?? null,
    todaySessions: todayDay?.sessions ?? [],
  };
}

export default function WidgetCoachDailyPlan({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetDailyOverview(userId);
        if (alive) setOverview(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Chyba pri načítaní daily plánu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(overview), [overview]);

  const note = ui.daysCount
    ? `Najbližších ${ui.daysCount} dní (horizon ${ui.horizonDays} d)`
    : "Vygeneruj daily plán (aspoň 1 týždeň) v coach sekcii.";

  return (
    <WidgetCard
      title="Coach — Daily plan"
      tooltip={TOOLTIP_COACH_DAILY}
      note={note}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          Nepodarilo sa načítať daily plán.
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !overview || !ui.daysCount ? (
        <div className={WIDGET_EMPTY_TEXT}>
          Zatiaľ nemáš uložený AI daily plán. Po vygenerovaní prvého týždňa sa tu
          zobrazí prehľad najbližších dní.
        </div>
      ) : (
        <>
          <div className={WIDGET_KV_GRID}>
            <div className={WIDGET_KV_LABEL}>Počet dní</div>
            <div className={WIDGET_KV_VALUE}>{ui.daysCount}</div>

            <div className={WIDGET_KV_LABEL}>Počet tréningov</div>
            <div className={WIDGET_KV_VALUE}>{ui.sessionsCount}</div>

            <div className={WIDGET_KV_LABEL}>Dnešok / najbližší deň</div>
            <div className={[WIDGET_KV_VALUE, WIDGET_TRUNCATE].join(" ")}>
              {ui.todayLabel ?? "—"}
            </div>
          </div>

          {ui.todaySessions && ui.todaySessions.length > 0 && (
            <div className={WIDGET_SUMMARY_WRAP}>
              <div className={WIDGET_SUMMARY_HEAD}>
                Dnešný plán (skrátený prehľad):
              </div>

              <ul className={WIDGET_LIST}>
                {ui.todaySessions.slice(0, 3).map((s, i) => (
                  <li key={i} className={WIDGET_LIST_ITEM}>
                    <span
                      className={WIDGET_BULLET}
                      style={{ background: appColors.brandPrimary }}
                    />
                    <span className={WIDGET_TRUNCATE}>
                      {s.title || s.session_type || s.sport}
                      {s.duration_min ? ` · ${s.duration_min} min` : ""}
                      {s.intensity ? ` · ${s.intensity}` : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {ui.todaySessions.length > 3 && (
                <div className={WIDGET_MORE_HINT}>
                  + {ui.todaySessions.length - 3} ďalších blokov…
                </div>
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}