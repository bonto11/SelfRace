"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_INFO_TEXT,
  WIDGET_LIST,
  WIDGET_LIST_ITEM,
  WIDGET_TRUNCATE,
} from "@/app/shared/ui/tokens";
import { type CoachNotesData } from "@/app/features/coach/api/coach_user_notes";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachNotes({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const t = useT();

  const { notes } = useCoachData();
  useEnsure(notes);
  const data: CoachNotesData | null = notes.data ?? null;
  const loading = !notes.loaded;
  const error = notes.error && notes.data === undefined;

  const hasNotes = (data?.sticky.length ?? 0) > 0 || data?.pending_ephemeral;

  return (
    <WidgetCard
      title={t("coachNotes.widget.title")}
      tooltip={t("coachNotes.widget.tooltip")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={140}
    >
      {loading || isChecking ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>{t("coachNotes.errorLoad")}</div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>{t("widget.missingUserId")}</div>
      ) : !hasNotes ? (
        <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2 mt-4 text-sm">
          📝 {t("coachNotes.widget.empty")}
        </div>
      ) : (
        <ul className={WIDGET_LIST}>
          {data?.sticky.map((n) => (
            <li key={n.id} className={WIDGET_LIST_ITEM}>
              <span className="shrink-0 text-[10px] font-bold text-emerald-400/80 uppercase">S</span>
              <span className={WIDGET_TRUNCATE}>{n.text}</span>
            </li>
          ))}
          {data?.pending_ephemeral && (
            <li className={WIDGET_LIST_ITEM}>
              <span className="shrink-0 text-[10px] font-bold text-yellow-400/80 uppercase">1×</span>
              <span className={WIDGET_TRUNCATE}>{data.pending_ephemeral.text}</span>
            </li>
          )}
        </ul>
      )}
    </WidgetCard>
  );
}
