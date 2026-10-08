// src/app/features/trainer/components/AthleteTrainerSection.tsx
"use client";

import { useState } from "react";

import { fmt, useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiTrainerEndLink,
  apiTrainerRegenerateCode,
  apiTrainerRespond,
  type TrainerOverview,
  type TrainerPerson,
} from "@/app/features/trainer/api/trainer";

type Props = {
  userId: number;
  overview: TrainerOverview | null;
  reload: () => Promise<void>;
  /** po prijatí trénera BE prepne coach_mode na advisor – prefs treba načítať nanovo */
  onAccepted: () => Promise<void>;
};

type Busy = `accept-${number}` | `reject-${number}` | "end" | "regen" | null;

/** "482915" -> "482 915" (ľahšie sa diktuje a prepisuje) */
export function formatShareCode(code: string | null | undefined): string {
  const c = String(code ?? "");
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

/**
 * Coach prefs → režim „Živý tréner“ (strana atléta): kód pre trénera,
 * čakajúce žiadosti a aktívny tréner. Prijatie je výslovný súhlas so
 * zdieľaním dát, preto sa pýta potvrdenie so zoznamom, čo tréner uvidí.
 */
export default function AthleteTrainerSection({ userId, overview, reload, onAccepted }: Props) {
  const t = useT();
  const [busy, setBusy] = useState<Busy>(null);

  const errorText = (code: string) => t(`trainer.errors.${code}` as any);
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t("common.locale")) : "";
  const personName = (p: TrainerPerson) => p.name || t("trainer.unnamed");

  const onAccept = async (req: TrainerPerson) => {
    if (busy) return;
    const ok = await confirm({
      title: fmt(t("trainer.athlete.acceptTitle"), { name: personName(req) }),
      message: t("trainer.athlete.acceptMessage"),
      okText: t("trainer.athlete.accept"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;

    setBusy(`accept-${req.link_id}`);
    try {
      const res = await apiTrainerRespond(userId, req.link_id, true);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("trainer.athlete.accepted"));
      await Promise.all([reload(), onAccepted()]);
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (req: TrainerPerson) => {
    if (busy) return;
    setBusy(`reject-${req.link_id}`);
    try {
      const res = await apiTrainerRespond(userId, req.link_id, false);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onEnd = async () => {
    const tr = overview?.trainer;
    if (!tr || busy) return;
    const ok = await confirm({
      title: t("trainer.athlete.endTitle"),
      message: t("trainer.athlete.endMessage"),
      okText: t("trainer.athlete.endOk"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setBusy("end");
    try {
      const res = await apiTrainerEndLink(userId, tr.link_id);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("trainer.athlete.ended"));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onRegenerate = async () => {
    if (busy) return;
    const ok = await confirm({
      title: t("trainer.code.regenerateTitle"),
      message: t("trainer.code.regenerateMessage"),
      okText: t("trainer.code.regenerate"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;

    setBusy("regen");
    try {
      const res = await apiTrainerRegenerateCode(userId);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    const code = overview?.share_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("trainer.code.copied"));
    } catch {
      toast.error(t("trainer.code.copyFailed"));
    }
  };

  const box: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${appColors.surfaceCardBorder}`,
    background: appColors.surfaceCard,
    marginBottom: 4,
  };
  const muted: React.CSSProperties = { color: appColors.textMuted };
  const spinner = <LoadingSpinner size="button" className="mr-2" />;

  if (!overview) {
    return (
      <div style={box} className="flex justify-center">
        <LoadingSpinner size="button" />
      </div>
    );
  }

  const trainer = overview.trainer;

  return (
    <div style={box} className="space-y-4">
      {trainer ? (
        <div className="space-y-2">
          <div className="text-xs" style={muted}>
            {t("trainer.athlete.yourTrainer")}
          </div>
          <div className="text-base font-semibold" style={{ color: appColors.textPrimary }}>
            {personName(trainer)}
          </div>
          {trainer.since ? (
            <div className="text-xs" style={muted}>
              {fmt(t("trainer.since"), { date: fmtDate(trainer.since) })}
            </div>
          ) : null}
          <p className="text-xs leading-relaxed" style={{ color: appColors.textSecondary }}>
            {t("trainer.athlete.activeHint")}
          </p>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onEnd}>
            {busy === "end" && spinner}
            {t("trainer.athlete.end")}
          </Button>
        </div>
      ) : (
        <>
          {overview.trainer_requests.map((req) => (
            <div
              key={req.link_id}
              className="space-y-2 pb-3"
              style={{ borderBottom: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                {fmt(t("trainer.athlete.requestFrom"), { name: personName(req) })}
              </div>
              {req.created_at ? (
                <div className="text-xs" style={muted}>
                  {fmtDate(req.created_at)}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => onAccept(req)}
                >
                  {busy === `accept-${req.link_id}` && spinner}
                  {t("trainer.athlete.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => onReject(req)}
                >
                  {busy === `reject-${req.link_id}` && spinner}
                  {t("trainer.athlete.reject")}
                </Button>
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <div className="text-xs" style={muted}>
              {t("trainer.code.label")}
            </div>
            <div
              className="text-2xl font-bold tracking-widest"
              style={{ color: appColors.textPrimary }}
            >
              {overview.share_code ? formatShareCode(overview.share_code) : "—"}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: appColors.textSecondary }}>
              {t("trainer.code.hint")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={!overview.share_code || busy !== null}
                onClick={onCopy}
              >
                {t("trainer.code.copy")}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onRegenerate}>
                {busy === "regen" && spinner}
                {t("trainer.code.regenerate")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
