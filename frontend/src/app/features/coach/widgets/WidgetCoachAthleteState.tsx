"use client";

import { useMemo } from "react";
import { AlertTriangle, Gauge } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { type AthleteStateRecord } from "@/app/features/coach/api/coach_athlete_state";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { useT } from "@/app/shared/i18n/useT";
import {
  Headline,
  Highlight,
  LevelMeter,
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

function extract(row: AthleteStateRecord | null) {
  if (!row?.state) return null;
  // staršie záznamy majú analýzu vnorenú pod `analysis`
  const s: any = row.state.ai_state ? row.state : (row.state as any).analysis || row.state;
  const ai = s.ai_state || {};
  const us = s.user_summary || {};
  return {
    fatigue: toLevel(ai.fatigue_level),
    injury: toLevel(ai.injury_risk),
    headline: (us.headline || us.short || null) as string | null,
    // bullets = čo ide dobre, risks = na čo si dať pozor (schéma athlete_state)
    plus: firstText(us.bullets),
    minus: firstText(us.risks),
  };
}

function worse(a: Level | null, b: Level | null): Level | null {
  const rank = { low: 1, moderate: 2, high: 3 } as const;
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}

export default function WidgetCoachAthleteState({ onOpenDetail }: Props) {
  const t = useT();
  const { athleteState } = useCoachData();
  useEnsure(athleteState);
  const row: AthleteStateRecord | null = athleteState.data ?? null;
  const loading = !athleteState.loaded;
  const failed = !!athleteState.error && athleteState.data === undefined;

  const ui = useMemo(() => extract(row), [row]);
  const top = worse(ui?.fatigue ?? null, ui?.injury ?? null);

  return (
    <WidgetCard
      title={t("coachAthleteState.widget.title")}
      tooltip={coachInfo(t, "athleteState")}
      accent={top === "high" || top === "moderate" ? toneColor(levelTone(top)) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("coachAthleteState.widget.errorFailedLoad")} />
      ) : !ui ? (
        <WidgetEmpty icon={Gauge} text={t("coachAthleteState.widget.missingData")}>
          <AiUsageWarningBanner />
        </WidgetEmpty>
      ) : (
        <div className={WK.stack}>
          <div className="grid grid-cols-2 gap-3">
            <LevelMeter
              label={t("coachAthleteState.widget.fatigue")}
              level={ui.fatigue}
              text={levelLabel(t, ui.fatigue)}
            />
            <LevelMeter
              label={t("coachAthleteState.widget.injuryRisk")}
              level={ui.injury}
              text={levelLabel(t, ui.injury)}
            />
          </div>
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
