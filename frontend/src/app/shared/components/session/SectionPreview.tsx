// src/app/features/coach/components/SectionPreview.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";

import { apiSessionPreviewAsk } from "@/app/features/coach/api/coach_plan_daily";

import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import {
  MAX_VERSIONS_FREE,
  MAX_VERSIONS_CLASSIC,
  MAX_VERSIONS_PRO,
  MAX_VERSIONS_FAMILY,
  MAX_COMMENT_CHARS,
} from "@/app/shared/config";

import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";

type Props = {
  sessionId: number;
  isEditable: boolean; // true len keď status === "planned" a session je v budúcnosti
  initialThread?: PreviewThreadEntry[];
};

const REFRESH_COOLDOWN_MS = 10000;

/* ================= thread types ================= */
type AssistantEntry = {
  role: "assistant";
  created_at?: string;
  reply_text?: string;
  changed?: boolean;
};

type UserEntry = {
  role: "user";
  created_at?: string;
  comment?: string | null;
  request_change?: boolean;
};

type PreviewThreadEntry = AssistantEntry | UserEntry;

/* ================= tier helpers ================= */
function maxVersionsForTier(tier: string): number {
  const parseSafe = (val: any, fallback: number) => {
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  };
  if (tier === "family") return parseSafe(MAX_VERSIONS_FAMILY, 10);
  if (tier === "pro") return parseSafe(MAX_VERSIONS_PRO, 3);
  if (tier === "classic") return parseSafe(MAX_VERSIONS_CLASSIC, 2);
  return parseSafe(MAX_VERSIONS_FREE, 1);
}

/* ================= UI helpers ================= */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">
      {children}
    </div>
  );
}

function TextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-white/80">
      {children}
    </div>
  );
}

function AssistantBubble({ entry, t }: { entry: AssistantEntry; t: any }) {
  const replyText =
    typeof entry.reply_text === "string" ? entry.reply_text.trim() : null;
  const changed = entry.changed === true;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 animate-in fade-in duration-500">
      {changed && (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300">
          ✏️ {t("sessions.preview.tagChanged")}
        </div>
      )}
      {replyText && (
        <div>
          <SectionTitle>{t("sessions.preview.sectionReply")}</SectionTitle>
          <TextBlock>{replyText}</TextBlock>
        </div>
      )}
    </div>
  );
}

function UserBubble({ entry, t }: { entry: UserEntry; t: any }) {
  if (!entry.comment) return null;
  return (
    <div className="ml-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 animate-in fade-in duration-500">
      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 mb-1">
        {t("sessions.review.youLabel") || "Ty"}
      </div>
      <div className="text-sm text-white/80 whitespace-pre-wrap">
        {entry.comment}
      </div>
      {entry.request_change && (
        <div className="mt-1 text-[10px] text-emerald-300/70">
          ✏️ {t("sessions.preview.requestChangeLabel")}
        </div>
      )}
    </div>
  );
}

/* ================= HLAVNÝ KOMPONENT ================= */

export default function SectionPreview({
  sessionId,
  isEditable,
  initialThread,
}: Props) {
  const { userId } = useUserId();
  const t = useT();

  const [tierCode, setTierCode] = useState<string>(() => {
    const storeTier = (getSubscriptionTier() || "").toLowerCase();
    return storeTier || "free";
  });

  useEffect(() => {
    return subscribeSubscriptionTier((tier) => {
      setTierCode(String(tier || "free").toLowerCase());
    });
  }, []);

  const maxVersions = useMemo(() => maxVersionsForTier(tierCode), [tierCode]);

  const [thread, setThread] = useState<PreviewThreadEntry[]>(
    initialThread || [],
  );
  const [comment, setComment] = useState<string>("");
  const [requestChange, setRequestChange] = useState<boolean>(false);

  const previewVersion = useMemo(
    () => thread.filter((e) => e.role === "assistant").length,
    [thread],
  );
  const hasPreview = previewVersion > 0;

  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;
  const showCharCount = commentLen > MAX_COMMENT_CHARS * 0.8;

  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [apiNote, setApiNote] = useState<string | null>(null);

  const canAskByTier = maxVersions > 1;
  const canAskByCount = previewVersion < maxVersions;
  const canFreeAsk = tierCode === "free" && previewVersion === 0;
  const canAsk = (canAskByTier && canAskByCount) || canFreeAsk;

  const onAsk = async () => {
    if (!userId || !sessionId || busyGen) return;
    setUiError(null);
    setApiNote(null);

    if (commentTooLong) {
      setUiError(t("sessions.review.errorCommentLong"));
      return;
    }
    if (!comment.trim()) {
      return;
    }

    setBusyGen(true);

    try {
      const c = comment.trim();

      const out = await apiSessionPreviewAsk(
        Number(userId),
        Number(sessionId),
        c,
        requestChange,
      );

      if (!out?.success) {
        const code = out?.error_code || "generic_error";
        const errorKey = `api.ai_errors.${code}`;
        const translatedError = t(errorKey as any);

        if (translatedError && translatedError !== errorKey) {
          setUiError(translatedError);
        } else {
          setUiError(t("api.ai_errors.generic_error"));
        }
      } else {
        setApiNote(t("sessions.preview.api.success"));

        const data = out.data || {};

        setThread((prev) => [
          ...prev,
          {
            role: "user",
            comment: c,
            request_change: requestChange,
            created_at: new Date().toISOString(),
          },
          {
            role: "assistant",
            reply_text: data.reply_text,
            changed: !!data.changed,
            created_at: new Date().toISOString(),
          },
        ]);

        setComment("");
        setRequestChange(false);
      }
    } catch (e: any) {
      const translatedError = t(e?.message);
      setUiError(translatedError || t("sessions.review.errorGeneric"));
    } finally {
      setBusyGen(false);
    }
  };

  // Read-only režim (session už nie je editovateľná - je v minulosti alebo
  // done/missed/postponed): história hore, "read only" hláška ako uzatvárajúca
  // poznámka dole (rovnaký chat-style princíp ako editovateľná vetva nižšie).
  if (!isEditable) {
    return (
      <ActivitySectionShell
        title={t("sessions.preview.title")}
        defaultOpen={false}
        items={[]}
      >
        <div className="space-y-3">
          {thread.length > 0 ? (
            thread.map((entry, idx) =>
              entry.role === "assistant" ? (
                <AssistantBubble key={`a-${idx}`} entry={entry} t={t} />
              ) : (
                <UserBubble key={`u-${idx}`} entry={entry} t={t} />
              ),
            )
          ) : (
            <div className="py-6 text-center border border-dashed border-white/10 rounded-lg">
              <p className="text-sm opacity-50">
                {t("sessions.preview.noPreviewPlaceholder")}
              </p>
            </div>
          )}
        </div>

        <div className="text-xs font-medium opacity-50 mt-4 pt-3 border-t border-white/10">
          {t("sessions.preview.readOnlyNote")}
        </div>
      </ActivitySectionShell>
    );
  }

  return (
    <ActivitySectionShell
      title={t("sessions.preview.title")}
      defaultOpen={thread.length === 0}
      items={[]}
    >
      {/* 1. CHAT HISTÓRIA — chronologicky, úplne hore */}
      <div className="space-y-3">
        {thread.length > 0
          ? thread.map((entry, idx) =>
              entry.role === "assistant" ? (
                <AssistantBubble key={`a-${idx}`} entry={entry} t={t} />
              ) : (
                <UserBubble key={`u-${idx}`} entry={entry} t={t} />
              ),
            )
          : !busyGen && (
              <div className="py-8 text-center border border-dashed border-white/10 rounded-lg">
                <p className="text-sm opacity-50">
                  {t("sessions.preview.noPreviewPlaceholder")}
                </p>
              </div>
            )}
      </div>

      {/* 2. COMPOSER — textarea + tlačidlo "Opýtať sa", vždy POD históriou */}
      {tierCode === "free" ? (
        <div className="mt-4 mb-2 p-3.5 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <span className="opacity-80">🔒</span>{" "}
            {t("sessions.preview.upsellTitle")}
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">
            {t("sessions.preview.upsellDesc")}
          </p>
        </div>
      ) : canAskByCount ? (
        <div className="mt-4 mb-2">
          <textarea
            className={`w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none transition-colors placeholder:text-white/20 ${commentTooLong ? "border-red-500/50 focus:border-red-500" : ""}`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("sessions.preview.commentPlaceholder")}
            disabled={busyGen}
          />
          {showCharCount && (
            <div
              className={`text-[10px] text-right mt-1 ${commentTooLong ? "text-red-400" : "opacity-40"}`}
            >
              {commentLen} / {MAX_COMMENT_CHARS}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={requestChange}
                onChange={(e) => setRequestChange(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-3.5 h-3.5"
                disabled={busyGen}
              />
              <span className="flex items-center gap-1.5 font-semibold">
                ✏️ {t("sessions.preview.requestChangeCheckbox")}
              </span>
            </label>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onAsk}
              disabled={busyGen || !comment.trim() || commentTooLong}
              className="ml-auto"
            >
              {busyGen
                ? t("sessions.review.btnGenerating")
                : t("sessions.preview.btnAsk")}
            </Button>
          </div>

          <div className="text-[11px] opacity-40 mt-3 pl-1">
            {requestChange
              ? t("sessions.preview.hintChangeScope")
              : t("sessions.preview.commentTip")}
          </div>
        </div>
      ) : (
        <div className="mt-4 mb-2 p-3 text-center text-[11px] text-white/40 border border-dashed border-white/10 rounded-xl">
          {t("sessions.review.limitReached")}
        </div>
      )}

      {/* 3. Chybové/úspešné hlášky */}
      {uiError && (
        <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-200">
          {uiError}
        </div>
      )}
      {apiNote && !uiError && (
        <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
          {apiNote}
        </div>
      )}

      {/* 4. STATUS — vždy úplne na konci */}
      <div className="flex items-center justify-between min-h-[32px] mt-4 pt-3 border-t border-white/10">
        <div className="text-xs font-medium opacity-70">
          {!hasPreview ? (
            <span>{t("sessions.preview.statusNoPreview")}</span>
          ) : (
            <span>
              {(
                t("sessions.review.statusReviewCount") ||
                "Version {{version}} / {{max}}"
              )
                .replace("{{version}}", String(previewVersion))
                .replace("{{max}}", String(maxVersions))}
            </span>
          )}
        </div>
      </div>
    </ActivitySectionShell>
  );
}
