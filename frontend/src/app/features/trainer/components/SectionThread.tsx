// src/app/features/trainer/components/SectionThread.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appLocale } from "@/app/shared/i18n/locale";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiGetSessionThread,
  apiPostSessionMessage,
  type SessionThread,
  type ThreadMessage,
} from "@/app/features/trainer/api/sessionMessages";
import { markThreadRead } from "@/app/features/trainer/hooks/useThreadUnread";

const MAX_LEN = 2000;

type Props = {
  /** naplánovaný tréning (má prednosť – spárovaná aktivita patrí k plánu) */
  planId?: number | null;
  /** aktivita mimo plánu */
  activityId?: number | null;
};

/**
 * Vlákno k tréningu medzi zverencom a jeho živým trénerom. Ukáže sa len,
 * keď je s kým písať (aktívny tréner) alebo existuje história – inak BE
 * vráti enabled=false a sekcia nič nevykreslí.
 */
export default function SectionThread({ planId, activityId }: Props) {
  const t = useT();
  // userId = zverenec (aj počas prezerania trénerom)
  const { userId, trainerView } = useUserId();
  const [thread, setThread] = useState<SessionThread | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const target = { planId: planId ?? null, activityId: planId ? null : activityId ?? null };

  const load = useCallback(async () => {
    if (!userId || (!target.planId && !target.activityId)) return;
    const res = await apiGetSessionThread(Number(userId), target);
    setThread(res);
    // BE pri čítaní označil správy ako prečítané – bodka na karte zhasne
    if (res.enabled) markThreadRead(target.planId, target.activityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, target.planId, target.activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!thread?.enabled) return null;

  const messages = thread.messages ?? [];
  const isTrainer = thread.role === "trainer";
  const otherLabel = isTrainer
    ? trainerView?.name || t("trainer.thread.athlete")
    : t("trainer.thread.trainer");

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(appLocale(), {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const onSend = async () => {
    const body = text.trim();
    if (!userId || !body || sending) return;
    setSending(true);
    try {
      const res = await apiPostSessionMessage(Number(userId), target, body);
      if (!res.ok) return void toast.error(t(`trainer.thread.errors.${res.errorCode}` as any));
      setText("");
      setThread((prev) =>
        prev ? { ...prev, messages: [...(prev.messages ?? []), res.message] } : prev,
      );
    } finally {
      setSending(false);
    }
  };

  const bubble = (m: ThreadMessage) => (
    <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
      <div className="text-[10px] mb-0.5" style={{ color: appColors.textMuted }}>
        {m.mine ? t("trainer.thread.you") : otherLabel} · {fmtTime(m.created_at)}
      </div>
      <div
        className="max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
        style={{
          background: m.mine ? appColors.buttonMainBg : appColors.surfaceSolid,
          color: m.mine ? appColors.buttonMainText : appColors.textPrimary,
          border: `1px solid ${appColors.surfaceCardBorder}`,
        }}
      >
        {m.body}
      </div>
    </div>
  );

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{ border: `1px solid ${appColors.surfaceCardBorder}`, background: appColors.surfaceCard }}
    >
      <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
        {isTrainer ? t("trainer.thread.titleTrainer") : t("trainer.thread.titleAthlete")}
      </div>

      {messages.length === 0 ? (
        <div className="text-xs" style={{ color: appColors.textMuted }}>
          {isTrainer ? t("trainer.thread.emptyTrainer") : t("trainer.thread.emptyAthlete")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">{messages.map(bubble)}</div>
      )}

      {thread.can_post ? (
        <div className="flex flex-col gap-2">
          <textarea
            rows={2}
            maxLength={MAX_LEN}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("trainer.thread.placeholder")}
            disabled={sending}
            className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none"
            style={{
              background: appColors.surfaceSolid,
              color: appColors.textPrimary,
              border: `1px solid ${appColors.surfaceCardBorder}`,
            }}
          />
          <Button
            size="sm"
            variant="primary"
            className="self-end"
            onClick={onSend}
            disabled={sending || !text.trim()}
          >
            {sending ? <LoadingSpinner size="button" /> : t("trainer.thread.send")}
          </Button>
        </div>
      ) : (
        <div className="text-[11px]" style={{ color: appColors.textMuted }}>
          {t("trainer.thread.readOnly")}
        </div>
      )}
    </div>
  );
}
