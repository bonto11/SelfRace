"use client";

import { useMemo } from "react";
import { Flag } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import type { RunRaceTarget } from "@/app/features/prefs/types/prefs";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  Segments,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr);
  race.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / 86_400_000);
}

const DISTANCE_KM: Record<string, number> = { "5k": 5, "10k": 10, half: 21.1, marathon: 42.2 };

export default function WidgetUpcomingRace({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const { prefs, prefsLoaded } = useCoachData();

  const race: RunRaceTarget | null = useMemo(() => {
    const races: RunRaceTarget[] = (prefs as any)?.targets?.run?.races ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // A pretek má prednosť pred bližším B/C – na neho sa plán ladí
    const upcoming = races
      .filter((r) => r.date && new Date(r.date) >= today)
      .sort((a, b) => {
        if (a.priority === "A" && b.priority !== "A") return -1;
        if (b.priority === "A" && a.priority !== "A") return 1;
        return new Date(a.date!).getTime() - new Date(b.date!).getTime();
      });
    return upcoming[0] ?? null;
  }, [prefs]);

  const days = race?.date ? daysUntil(race.date) : null;
  const weeks = days != null ? Math.ceil(days / 7) : 0;
  // posledné 3 týždne = ladenie formy (taper), posledný týždeň už len udržiavať
  const tone: Tone = days == null ? "neutral" : days <= 7 ? "danger" : days <= 21 ? "warn" : "info";
  const phaseLabel =
    days == null
      ? ""
      : days <= 7
        ? t("coachWidgets.race.phaseRaceWeek")
        : days <= 21
          ? t("coachWidgets.race.phaseTaper")
          : t("coachWidgets.race.phaseBuild");

  const km = race ? (race.custom_distance_km ?? DISTANCE_KM[race.race_goal ?? ""] ?? null) : null;
  const dateLabel = race?.date
    ? new Date(race.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
    : "";
  const sub = [race?.name, dateLabel].filter(Boolean).join(" · ");
  const caption = [
    km ? `${String(km).replace(".", locale.startsWith("sk") ? "," : ".")} km` : null,
    race?.target_time ? `${t("coachWidgets.race.target")} ${race.target_time}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <WidgetCard
      title={t("upcomingRace.widget.title")}
      tooltip={coachInfo(t, "race")}
      accent={days != null && days <= 21 ? toneColor(tone) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {!prefsLoaded ? (
        <WidgetLoading />
      ) : !race || days == null ? (
        <WidgetEmpty icon={Flag} text={t("upcomingRace.widget.noRace")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Flag} color={toneColor(tone)} />}
            value={days}
            unit={t("common.units.days")}
            sub={sub}
            right={
              race.priority ? (
                <Pill tone={race.priority === "A" ? "warn" : "neutral"} icon={Flag} label={race.priority} />
              ) : null
            }
          />
          {/* posledných 12 týždňov po dieliku – vidno, koľko prípravy ostáva */}
          <div className="space-y-1.5">
            <Segments done={Math.max(0, 12 - Math.min(12, weeks))} total={12} color={toneColor(tone)} />
            <Caption>{[phaseLabel, caption].filter(Boolean).join(" · ")}</Caption>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
