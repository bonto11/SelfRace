"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BatteryLow, Bandage, HeartPulse, Moon, Thermometer } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useT } from "@/app/shared/i18n/useT";
import { type HealthLogRecord } from "@/app/features/coach/api/users_health_log";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import {
  IconTile,
  ListRow,
  Pill,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";

type Props = { onOpenDetail?: () => void };

const NO_LOGS: HealthLogRecord[] = [];

const TYPE_ICON: Record<HealthLogRecord["event_type"], LucideIcon> = {
  injury: Bandage,
  illness: Thermometer,
  fatigue: BatteryLow,
  menstruation: Moon,
};

/** rovnaké hranice ako plán: od 7 sa trénovať nemá, od 4 sa plán zľahčí */
function severityTone(sev: number): Tone {
  return sev >= 7 ? "danger" : sev >= 4 ? "warn" : "info";
}

export default function WidgetAthleteHealth({ onOpenDetail }: Props) {
  const t = useT();
  const { healthActive } = useCoachData();
  useEnsure(healthActive);
  const logs: HealthLogRecord[] = healthActive.data ?? NO_LOGS;
  const loading = !healthActive.loaded;
  const failed = !!healthActive.error && healthActive.data === undefined;

  const sorted = useMemo(() => [...logs].sort((a, b) => (b.severity || 0) - (a.severity || 0)), [logs]);
  const max = sorted[0]?.severity || 0;

  return (
    <WidgetCard
      title={t("healthLog.widget.title")}
      tooltip={coachInfo(t, "health")}
      accent={max >= 4 ? toneColor(severityTone(max)) : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={140}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("healthLog.widget.errorFailedLoad")} />
      ) : !logs.length ? (
        <WidgetEmpty icon={HeartPulse} tone="good" text={t("healthLog.widget.allGood")} />
      ) : (
        <div className="flex flex-col gap-1.5 text-left">
          {sorted.slice(0, 3).map((log, i) => {
            const tone = severityTone(log.severity || 0);
            return (
              <div key={log.id ?? i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <ListRow
                    icon={<IconTile small icon={TYPE_ICON[log.event_type] ?? HeartPulse} color={toneColor(tone)} />}
                    label={log.notes || t(`healthLog.types.${log.event_type}` as any)}
                  />
                </div>
                <Pill tone={tone} label={`${log.severity}/10`} />
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
