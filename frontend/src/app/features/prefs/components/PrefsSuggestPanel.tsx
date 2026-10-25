// src/app/features/prefs/components/PrefsSuggestPanel.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { alpha } from "@/app/shared/ui/theme/colorUtils";
import {
  apiSuggestPrefs,
  type PrefsChange,
  type PrefsSuggestion,
  type PrefsThreadEntry,
} from "@/app/features/prefs/api/prefsSuggest";

const KNOWN_ERRORS = [
  "ai_quota_exceeded",
  "limit_reached",
  "empty_comment",
  "empty_request",
  "feature_disabled",
  "forbidden",
] as const;

const TEXTAREA =
  "w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20";

/**
 * „Povedz, čo chceš dosiahnuť“ nad sekciami Coach prefs. AI navrhne zmeny
 * nastavení s vysvetlením (prečo, ako sa prejavia v pláne); user odškrtne,
 * čo nechce, a vybrané sa zapíšu do formulára a uložia (onApply).
 */
export default function PrefsSuggestPanel({
  userId,
  onApply,
}: {
  userId: number;
  onApply: (changes: PrefsChange[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<PrefsThreadEntry[]>([]);
  const [last, setLast] = useState<PrefsSuggestion | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  const isRefine = !!last;
  const roundsLeft = last ? last.rounds_left : null;

  const ask = async () => {
    const request = text.trim();
    if (busy || !request || (isRefine && (roundsLeft ?? 0) <= 0)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiSuggestPrefs(userId, { request, thread });
      setLast(res);
      setPicked(new Set(res.changes.map((c) => c.field)));
      setApplied(false);
      setThread((prev) => [...prev, { role: "user", text: request }, { role: "assistant", reply_text: res.reply_text }]);
      setText("");
    } catch (e: any) {
      const code = String(e?.message || "");
      setError((KNOWN_ERRORS as readonly string[]).includes(code) ? code : "ai_generation_failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (field: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });

  const apply = () => {
    if (!last) return;
    const chosen = last.changes.filter((c) => picked.has(c.field));
    if (!chosen.length) return;
    onApply(chosen);
    setApplied(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-xl border px-4 py-3"
        style={{ borderColor: alpha(appColors.brandPrimary, 0.35), background: alpha(appColors.brandPrimary, 0.06) }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">✨ {t("prefsSuggest.title")}</div>
            <div className="text-xs mt-0.5" style={{ color: appColors.textMuted }}>
              {t("prefsSuggest.teaser")}
            </div>
          </div>
          <TooltipIcon text={t("prefsSuggest.info")} title={t("prefsSuggest.title")} size={24} />
        </div>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-2"
      style={{ borderColor: alpha(appColors.brandPrimary, 0.35), background: alpha(appColors.brandPrimary, 0.06) }}
    >
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold flex-1 min-w-0">✨ {t("prefsSuggest.title")}</div>
        <TooltipIcon text={t("prefsSuggest.info")} title={t("prefsSuggest.title")} size={24} />
      </div>

      {last ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed">{last.reply_text}</p>
          {last.changes.length ? (
            <ul className="flex flex-col gap-1.5">
              {last.changes.map((c) => (
                <li key={c.field}>
                  <label
                    className="flex gap-2 items-start rounded-lg px-2.5 py-2 cursor-pointer"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", opacity: picked.has(c.field) ? 1 : 0.55 }}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.has(c.field)}
                      disabled={applied}
                      onChange={() => toggle(c.field)}
                    />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: appColors.textMuted }}>
                        {t(`prefsSuggest.fields.${c.field.replace(/\./g, "_")}` as any)}
                      </span>
                      <span className="text-sm">
                        {c.from_text ? (
                          <>
                            <span style={{ color: appColors.textMuted }}>{c.from_text}</span> →{" "}
                          </>
                        ) : null}
                        <span className="font-semibold">{c.value_text}</span>
                      </span>
                      {c.why ? <span className="text-xs leading-snug">{c.why}</span> : null}
                      {c.effect ? (
                        <span className="text-xs leading-snug" style={{ color: appColors.textMuted }}>
                          {t("prefsSuggest.effect")}: {c.effect}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: appColors.textMuted }}>
              {t("prefsSuggest.noChanges")}
            </p>
          )}
          {last.todo.length ? (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold opacity-50 mb-1">{t("prefsSuggest.todo")}</div>
              <ul className="flex flex-col gap-1">
                {last.todo.map((x, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="opacity-50">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {last.changes.length ? (
            applied ? (
              <p className="text-xs" style={{ color: appColors.statusSuccess }}>
                ✓ {t("prefsSuggest.applied")}
              </p>
            ) : (
              <Button type="button" size="sm" variant="primary" className="self-start" disabled={!picked.size} onClick={apply}>
                {fmt(t("prefsSuggest.apply"), { n: picked.size })}
              </Button>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: appColors.textMuted }}>
          {t("prefsSuggest.hint")}
        </p>
      )}

      {isRefine && roundsLeft === 0 ? (
        <p className="text-[11px]" style={{ color: appColors.textMuted }}>
          {t("prefsSuggest.noMoreRounds")}
        </p>
      ) : (
        <>
          <textarea
            className={TEXTAREA}
            rows={isRefine ? 2 : 5}
            maxLength={1500}
            value={text}
            disabled={busy}
            placeholder={isRefine ? t("prefsSuggest.refinePlaceholder") : t("prefsSuggest.placeholder")}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={isRefine ? "secondary" : "primary"} disabled={busy || !text.trim()} onClick={ask}>
              {busy ? (
                <LoadingSpinner size="button" />
              ) : isRefine ? (
                fmt(t("prefsSuggest.refine"), { n: roundsLeft ?? 0 })
              ) : (
                t("prefsSuggest.ask")
              )}
            </Button>
            {!last ? (
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </>
      )}

      {error === "ai_quota_exceeded" ? <AiUsageWarningBanner forceShow /> : null}
      {error ? (
        <p className="text-xs" style={{ color: appColors.statusError }}>
          {t(`prefsSuggest.errors.${error}` as any)}
        </p>
      ) : null}
    </div>
  );
}
