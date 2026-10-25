// src/app/features/coach/components/SessionSuggestPanel.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { alpha } from "@/app/shared/ui/theme/colorUtils";
import {
  apiSuggestSession,
  type SessionSuggestion,
  type SuggestThreadEntry,
} from "@/app/features/coach/api/sessionSuggest";
import type { SessionTemplateData } from "@/app/features/coach/constants/sessionTemplates";

const KNOWN_ERRORS = [
  "ai_quota_exceeded",
  "limit_reached",
  "empty_comment",
  "feature_disabled",
  "forbidden",
] as const;

/**
 * „Navrhni mi tréning“ v ManualSessionForm. AI pozrie posledné dni, deň
 * po a recovery, a vyplní formulár – user ho skontroluje a uloží sám.
 * Návrh sa dá 2× upraviť komentárom (ako pri hodnotení aktivity).
 */
export default function SessionSuggestPanel({
  userId,
  planDate,
  onApply,
}: {
  userId: number;
  planDate: string;
  onApply: (session: SessionTemplateData) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<SuggestThreadEntry[]>([]);
  const [last, setLast] = useState<SessionSuggestion | null>(null);

  const isRefine = !!last;
  const roundsLeft = last ? last.rounds_left : null;
  const canAsk = !busy && (!isRefine || (roundsLeft ?? 0) > 0) && (!isRefine || !!text.trim());

  const ask = async () => {
    if (!canAsk) return;
    setBusy(true);
    setError(null);
    const request = text.trim() || null;
    try {
      const res = await apiSuggestSession(userId, { plan_date: planDate, request, thread });
      onApply(res.session);
      setLast(res);
      setThread((prev) => [
        ...prev,
        { role: "user", text: request ?? "" },
        { role: "assistant", reply_text: res.reply_text, session: res.session },
      ]);
      setText("");
    } catch (e: any) {
      const code = String(e?.message || "");
      setError((KNOWN_ERRORS as readonly string[]).includes(code) ? code : "ai_generation_failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} className="self-start">
        ✨ {t("advisorDaily.suggest.open")}
      </Button>
    );
  }

  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-2 shrink-0"
      style={{ borderColor: alpha(appColors.brandPrimary, 0.35), background: alpha(appColors.brandPrimary, 0.06) }}
    >
      <div className="text-sm font-semibold">✨ {t("advisorDaily.suggest.title")}</div>

      {last ? (
        <div className="flex flex-col gap-2">
          {last.warning ? (
            <div
              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{
                color: appColors.statusWarning,
                border: `1px solid ${alpha(appColors.statusWarning, 0.5)}`,
                background: alpha(appColors.statusWarning, 0.08),
              }}
            >
              ⚠️ {last.warning}
            </div>
          ) : null}
          <p className="text-xs leading-relaxed" style={{ color: appColors.textPrimary }}>
            {last.reply_text}
          </p>
          <p className="text-[11px]" style={{ color: appColors.textMuted }}>
            {t("advisorDaily.suggest.filled")}
          </p>
        </div>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: appColors.textMuted }}>
          {t("advisorDaily.suggest.hint")}
        </p>
      )}

      {isRefine && roundsLeft === 0 ? (
        <p className="text-[11px]" style={{ color: appColors.textMuted }}>
          {t("advisorDaily.suggest.noMoreRounds")}
        </p>
      ) : (
        <>
          <textarea
            className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
            rows={2}
            maxLength={500}
            value={text}
            disabled={busy}
            placeholder={isRefine ? t("advisorDaily.suggest.refinePlaceholder") : t("advisorDaily.suggest.placeholder")}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="button" size="sm" variant="primary" disabled={!canAsk} onClick={ask} className="self-start">
            {busy ? (
              <LoadingSpinner size="button" />
            ) : isRefine ? (
              fmt(t("advisorDaily.suggest.refine"), { n: roundsLeft ?? 0 })
            ) : (
              t("advisorDaily.suggest.ask")
            )}
          </Button>
        </>
      )}

      {error === "ai_quota_exceeded" ? <AiUsageWarningBanner forceShow /> : null}
      {error ? (
        <p className="text-xs" style={{ color: appColors.statusError }}>
          {t(`advisorDaily.suggest.errors.${error}` as any)}
        </p>
      ) : null}
    </div>
  );
}
