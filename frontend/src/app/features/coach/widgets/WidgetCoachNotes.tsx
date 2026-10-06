"use client";

import { AlertTriangle, Clock3, MessageSquareText, Pin } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { type CoachNotesData } from "@/app/features/coach/api/coach_user_notes";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { Caption, IconTile, ListRow, WidgetEmpty, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachNotes({ onOpenDetail }: Props) {
  const t = useT();
  const { notes } = useCoachData();
  useEnsure(notes);
  const data: CoachNotesData | null = notes.data ?? null;
  const loading = !notes.loaded;
  const failed = !!notes.error && notes.data === undefined;

  const sticky = data?.sticky ?? [];
  const once = data?.pending_ephemeral ?? null;
  const shown = sticky.slice(0, once ? 2 : 3);

  return (
    <WidgetCard
      title={t("coachNotes.widget.title")}
      tooltip={coachInfo(t, "notes")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={140}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("coachNotes.errorLoad")} />
      ) : !sticky.length && !once ? (
        <WidgetEmpty icon={MessageSquareText} text={t("coachNotes.widget.empty")} />
      ) : (
        <div className="flex flex-col gap-1.5 text-left">
          {once ? (
            <ListRow icon={<IconTile small icon={Clock3} color={appColors.statusWarning} />} label={once.text} />
          ) : null}
          {shown.map((n) => (
            <ListRow key={n.id} icon={<IconTile small icon={Pin} color={appColors.statusInfo} />} label={n.text} />
          ))}
          {data && data.sticky_slots_max ? (
            <Caption>
              {t("coachWidgets.notes.slots")} {data.sticky_slots_used}/{data.sticky_slots_max}
            </Caption>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
