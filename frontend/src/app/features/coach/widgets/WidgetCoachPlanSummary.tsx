"use client";

import { AlertTriangle, Trophy } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { type PlanSummaryRecord } from "@/app/features/coach/api/coach_plan_active";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  Headline,
  Highlight,
  IconTile,
  Pill,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo, firstText } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachPlanSummary({ onOpenDetail }: Props) {
  const t = useT();
  const { planSummary } = useCoachData();
  useEnsure(planSummary);
  const row: PlanSummaryRecord | null = planSummary.data ?? null;
  const loading = !planSummary.loaded;
  const failed = !!planSummary.error && planSummary.data === undefined;

  const ai = row?.raw_ai_json ?? {};
  const achieved = ai.achieved_target;
  // null = pretek ešte nebol alebo nemal cieľový čas – vtedy bez verdiktu
  const tone: Tone | null = achieved === true ? "good" : achieved === false ? "warn" : null;
  const plus = firstText(ai.highlights);
  const minus = firstText(ai.areas_to_improve);
  const headline = row?.ai_headline || ai.headline || null;

  return (
    <WidgetCard
      title={t("coachPlanSummary.widget.title")}
      tooltip={coachInfo(t, "planSummary")}
      accent={tone === "good" ? toneColor("good") : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("coachPlanSummary.widget.errorFailedLoad")} />
      ) : !row ? (
        <WidgetEmpty icon={Trophy} text={t("coachPlanSummary.widget.missingData")}>
          <AiUsageWarningBanner />
        </WidgetEmpty>
      ) : (
        <div className={WK.stack}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <IconTile icon={Trophy} color={tone ? toneColor(tone) : appColors.textSecondary} />
              <span className="text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
                {row.race_name || t("coachWidgets.planSummary.noRace")}
              </span>
            </div>
            {tone ? (
              <Pill
                tone={tone}
                label={achieved ? t("coachWidgets.planSummary.achieved") : t("coachWidgets.planSummary.missed")}
              />
            ) : null}
          </div>
          {headline ? <Headline>{headline}</Headline> : null}
          {plus || minus ? (
            <div className="space-y-1.5">
              {plus ? <Highlight tone="good" text={plus} /> : null}
              {minus ? <Highlight tone="warn" text={minus} /> : null}
            </div>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
