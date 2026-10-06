"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useT } from "@/app/shared/i18n/useT";
import { type AthleteProgressRecord } from "@/app/features/coach/api/coach_athlete_state";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  Headline,
  Highlight,
  WidgetEmpty,
  WidgetLoading,
  levelTone,
  toLevel,
  toneColor,
  type Level,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo, firstText, levelLabel } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = { onOpenDetail?: () => void };

function extract(row: AthleteProgressRecord | null) {
  const cp: any = (row as any)?.report ?? (row as any)?.compare_previous ?? null;
  if (!row || !cp) return null;
  const comp = cp.comparisons || {};
  const rec = cp.recommendations || {};
  return {
    headline: (cp.summary?.headline || cp.headline || null) as string | null,
    fatigue: { prev: toLevel(comp.fatigue_level?.previous), cur: toLevel(comp.fatigue_level?.current) },
    injury: { prev: toLevel(comp.injury_risk?.previous), cur: toLevel(comp.injury_risk?.current) },
    // celebrations = čo sa zlepšilo, risks_to_watch = čo sledovať (schéma progress)
    plus: firstText(rec.celebrations) ?? firstText(cp.summary?.bullets),
    minus: firstText(rec.risks_to_watch),
  };
}

/** únava / riziko minule → teraz; farba podľa aktuálnej úrovne */
function Change({ label, prev, cur }: { label: string; prev: Level | null; cur: Level | null }) {
  const t = useT();
  if (!cur) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide truncate" style={{ color: appColors.textMuted }}>
        {label}
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold mt-0.5 min-w-0">
        {prev && prev !== cur ? (
          <>
            <span className="truncate" style={{ color: appColors.textMuted }}>
              {levelLabel(t, prev)}
            </span>
            <ArrowRight size={12} className="shrink-0" color={appColors.textMuted} />
          </>
        ) : null}
        <span className="truncate" style={{ color: toneColor(levelTone(cur)) }}>
          {levelLabel(t, cur)}
        </span>
      </div>
    </div>
  );
}

export default function WidgetCoachProgress({ onOpenDetail }: Props) {
  const t = useT();
  const { progress } = useCoachData();
  useEnsure(progress);
  const row: AthleteProgressRecord | null = progress.data ?? null;
  const loading = !progress.loaded;
  const failed = !!progress.error && progress.data === undefined;
  const ui = useMemo(() => extract(row), [row]);

  return (
    <WidgetCard
      title={t("coachProgress.widget.title")}
      tooltip={coachInfo(t, "progress")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("coachProgress.widget.errorTitle")} />
      ) : !ui ? (
        <WidgetEmpty icon={TrendingUp} text={t("coachProgress.widget.empty")} />
      ) : (
        <div className={WK.stack}>
          {ui.fatigue.cur || ui.injury.cur ? (
            <div className="grid grid-cols-2 gap-3">
              <Change label={t("coachAthleteState.widget.fatigue")} prev={ui.fatigue.prev} cur={ui.fatigue.cur} />
              <Change label={t("coachAthleteState.widget.injuryRisk")} prev={ui.injury.prev} cur={ui.injury.cur} />
            </div>
          ) : null}
          {ui.headline ? <Headline>{ui.headline}</Headline> : null}
          {ui.plus || ui.minus ? (
            <div className="space-y-1.5">
              {ui.plus ? <Highlight tone="good" text={ui.plus} /> : null}
              {ui.minus ? <Highlight tone="warn" text={ui.minus} /> : null}
            </div>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
