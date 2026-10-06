"use client";

import { ListChecks } from "lucide-react";
import { useT } from "@/app/shared/i18n/useT";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  Dot,
  Hero,
  IconTile,
  Pill,
  StackBar,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachPlanCompliance({ onOpenDetail }: Props) {
  const t = useT();
  const { loading: coachLoading, compliance } = useCoachData();
  useEnsure(compliance);
  const data = compliance.data ?? null;
  const loading = !compliance.loaded || coachLoading;

  const stats = data?.stats || { done: 0, postponed: 0, skipped: 0, missed: 0 };
  const postponed = stats.postponed || stats.skipped || 0;
  const total = stats.done + postponed + stats.missed;
  const rate = total > 0 ? Math.round((stats.done / total) * 100) : null;
  // 80 % = väčšina tréningov sedí, plán funguje; pod 60 % treba plán upraviť realite
  const tone: Tone = rate == null ? "neutral" : rate >= 80 ? "good" : rate >= 60 ? "warn" : "danger";
  const toneText =
    tone === "good"
      ? t("activityWidgets.tone.good")
      : tone === "warn"
        ? t("activityWidgets.tone.warn")
        : t("coachWidgets.compliance.low");

  const cDone = appColors.statusSuccess;
  const cPost = appColors.textMuted;
  const cMiss = appColors.statusError;

  return (
    <WidgetCard
      title={t("coachCompliance.widget.title")}
      tooltip={coachInfo(t, "compliance")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : rate == null ? (
        <WidgetEmpty icon={ListChecks} text={t("coachWidgets.compliance.empty")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={ListChecks} color={toneColor(tone)} />}
            value={rate}
            unit="%"
            sub={t("coachWidgets.compliance.sub")}
            right={<Pill tone={tone} label={toneText} />}
          />
          <div className="space-y-2">
            <StackBar
              parts={[
                { value: stats.done, color: cDone },
                { value: postponed, color: cPost },
                { value: stats.missed, color: cMiss },
              ]}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Dot color={cDone} label={t("coachCompliance.stats.completed")} value={String(stats.done)} />
              <Dot color={cPost} label={t("coachCompliance.stats.postponed")} value={String(postponed)} />
              <Dot color={cMiss} label={t("coachCompliance.stats.missed")} value={String(stats.missed)} />
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
