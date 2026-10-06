"use client";

import { Target } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { Hero, IconTile, Pill, SportTile, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs, prefsLoaded } = useCoachData();
  const t = useT();

  const sports = [prefs?.main_sport, ...((prefs?.add_on_sports as SportKind[] | undefined) ?? [])]
    .filter((s): s is SportKind => !!s && s !== ("other" as any))
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const goal = prefs?.goal_kind
    ? t(`prefs.sections.goalSection.enums.overall.${prefs.goal_kind}` as any)
    : null;

  const vol = prefs?.volume;
  const volText = vol?.value
    ? fmt(t(vol.mode === "daily_minutes" ? "coachWidgets.prefs.perDay" : "coachWidgets.prefs.perWeek"), {
        n: vol.value,
      })
    : null;
  const sub = [volText, prefs?.weeks ? `${prefs.weeks} ${t("coachWidgets.weekly.weeks")}` : null]
    .filter(Boolean)
    .join(" · ");

  const advisor = prefs?.coach_mode === "advisor";

  return (
    <WidgetCard
      title={t("coachPrefs.widget.title")}
      tooltip={coachInfo(t, "prefs")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={140}
    >
      {!prefsLoaded ? (
        <WidgetLoading />
      ) : (
        <div className={WK.stack}>
          <Hero
            size="md"
            icon={<IconTile icon={Target} color={goal ? appColors.brandPrimary : appColors.statusWarning} />}
            value={goal ?? t("coachWidgets.prefs.noGoal")}
            sub={sub || undefined}
            right={
              <Pill
                tone="neutral"
                label={advisor ? t("prefs.coachMode.advisorLabel") : t("prefs.coachMode.coachLabel")}
              />
            }
          />
          {sports.length ? (
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => (
                <SportTile key={s} sport={s} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
