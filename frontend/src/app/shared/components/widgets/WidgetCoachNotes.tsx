"use client";

import { useEffect, useState } from "react";
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
import { apiGetCoachNotes, type CoachNotesData } from "@/app/features/coach/api/coach_user_notes";

type Props = { onOpenDetail?: () => void };

export default function WidgetCoachNotes({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const t = useT();
  const [data, setData] = useState<CoachNotesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isChecking) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGetCoachNotes(userId);
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, isChecking]);

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
