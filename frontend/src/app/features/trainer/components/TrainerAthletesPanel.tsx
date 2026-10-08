// src/app/features/trainer/components/TrainerAthletesPanel.tsx
"use client";

import { useState } from "react";

import { fmt, useT } from "@/app/shared/i18n/useT";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY } from "@/app/shared/ui/tokens";
import {
  apiTrainerEndLink,
  apiTrainerRequestAthlete,
  type TrainerAthlete,
  type TrainerSentRequest,
} from "@/app/features/trainer/api/trainer";
import { useTrainerOverview } from "@/app/features/trainer/hooks/useTrainerOverview";
import { formatShareCode } from "@/app/features/trainer/components/AthleteTrainerSection";

type Busy = "add" | `end-${number}` | null;

/**
 * Nastavenia → Moji zverenci (strana trénera): pridanie atléta cez jeho
 * kód, čakajúce žiadosti a aktívni zverenci. Meno atléta sa ukáže až po
 * jeho potvrdení – dovtedy len kód, ktorý tréner zadal.
 */
export default function TrainerAthletesPanel() {
  const t = useT();
  const { userId, overview, reload } = useTrainerOverview();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);

  const errorText = (c: string) => t(`trainer.errors.${c}` as any);
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t("common.locale")) : "";
  const muted: React.CSSProperties = { color: appColors.textMuted };
  const spinner = <LoadingSpinner size="button" className="mr-2" />;

  const athletes = overview?.athletes ?? [];
  const sent = overview?.sent_requests ?? [];

  const onAdd = async () => {
    if (!userId || busy) return;
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) return void toast.error(errorText("invalid_code"));

    setBusy("add");
    try {
      const res = await apiTrainerRequestAthlete(userId, digits);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      toast.success(t("trainer.coach.requestSent"));
      setCode("");
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onEnd = async (linkId: number, kind: "athlete" | "request") => {
    if (!userId || busy) return;
    if (kind === "athlete") {
      const ok = await confirm({
        title: t("trainer.coach.endTitle"),
        message: t("trainer.coach.endMessage"),
        okText: t("trainer.coach.endOk"),
        cancelText: t("common.cancel"),
        tone: "danger",
      });
      if (!ok) return;
    }

    setBusy(`end-${linkId}`);
    try {
      const res = await apiTrainerEndLink(userId, linkId);
      if (!res.ok) return void toast.error(errorText(res.errorCode));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const preview = athletes.length
    ? fmt(t("trainer.coach.previewCount"), { n: athletes.length })
    : t("trainer.coach.previewEmpty");

  const row = (key: number, title: string, sub: string, action: React.ReactNode) => (
    <div key={key} className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
          {title}
        </div>
        {sub ? (
          <div className="text-xs" style={muted}>
            {sub}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );

  // Kým BE nepovie, že je funkcia pre usera zapnutá (TRAINER_USERS), karta
  // sa vôbec neukáže – ani počas načítania, aby neprebliklo.
  if (!overview?.enabled) return null;

  return (
    <InputsCard
      title={t("trainer.coach.title")}
      subtitle={t("trainer.coach.desc")}
      preview={preview}
      backdropVariant="default"
    >
      <div className={INPUTS_CARD_BODY}>
        <div className="space-y-4">
          <div className="space-y-2">
            <TextField
              label={t("trainer.coach.codeLabel")}
              placeholder="123 456"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onAdd();
              }}
            />
            <p className="text-[11px]" style={muted}>
              {t("trainer.coach.codeHint")}
            </p>
            <Button size="sm" variant="primary" disabled={busy !== null || !userId} onClick={onAdd}>
              {busy === "add" && spinner}
              {t("trainer.coach.add")}
            </Button>
          </div>

          {athletes.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1" style={muted}>
                {t("trainer.coach.athletes")}
              </div>
              {athletes.map((a: TrainerAthlete) =>
                row(
                  a.link_id,
                  a.name || t("trainer.unnamed"),
                  a.since ? fmt(t("trainer.since"), { date: fmtDate(a.since) }) : "",
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => onEnd(a.link_id, "athlete")}
                  >
                    {busy === `end-${a.link_id}` && spinner}
                    {t("trainer.coach.end")}
                  </Button>,
                ),
              )}
            </div>
          )}

          {sent.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1" style={muted}>
                {t("trainer.coach.pending")}
              </div>
              {sent.map((r: TrainerSentRequest) =>
                row(
                  r.link_id,
                  fmt(t("trainer.coach.pendingCode"), {
                    code: formatShareCode(r.request_code),
                  }),
                  t("trainer.coach.pendingHint"),
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => onEnd(r.link_id, "request")}
                  >
                    {busy === `end-${r.link_id}` && spinner}
                    {t("trainer.coach.cancelRequest")}
                  </Button>,
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </InputsCard>
  );
}
