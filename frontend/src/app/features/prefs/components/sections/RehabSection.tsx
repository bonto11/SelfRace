// src/features/coach/components/RehabSection.tsx
"use client";

import * as React from "react";

import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import InputsCard from "@/app/shared/ui/components/InputsCard";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import type { RehabFocus } from "@/app/features/prefs/types/prefs";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function RehabSection({ local, setPref }: Props) {
  const t = useT();
  const rf = (local.rehab_focus ?? {}) as RehabFocus;

  const setRehab = (patch: Partial<RehabFocus>) =>
    setPref("rehab_focus", {
      stretching: !!rf.stretching,
      mobility: !!rf.mobility,
      balance: !!rf.balance,
      recovery_protocol: rf.recovery_protocol ?? null,
      ...patch,
    } as RehabFocus);

  const toggle = (key: keyof RehabFocus) => {
    if (key === "recovery_protocol") return;
    setRehab({ [key]: !Boolean((rf as any)[key]) } as Partial<RehabFocus>);
  };

  const preview = `${t("prefs.sections.rehabSection.previewFocus")}: ${
    (rf.stretching ? 1 : 0) + (rf.mobility ? 1 : 0) + (rf.balance ? 1 : 0)
  } · ${t("prefs.sections.rehabSection.previewProtocol")}: ${rf.recovery_protocol ? t("common.set") : "—"}`;

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.rehabSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.rehabSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.rehabSection.subtitle")}
      preview={preview}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="flex items-center gap-2 text-xs opacity-80">
          <span>{t("prefs.sections.rehabSection.focusLabel")}</span>
          <TooltipIcon text={t("prefs.sections.rehabSection.focusTooltip")} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="prefs"
            active={!!rf.stretching}
            onClick={() => toggle("stretching")}
          >
            {t("prefs.sections.rehabSection.enums.stretching")}
          </Button>

          <Button
            size="xs"
            variant="prefs"
            active={!!rf.mobility}
            onClick={() => toggle("mobility")}
          >
            {t("prefs.sections.rehabSection.enums.mobility")}
          </Button>

          <Button
            size="xs"
            variant="prefs"
            active={!!rf.balance}
            onClick={() => toggle("balance")}
          >
            {t("prefs.sections.rehabSection.enums.balance")}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs opacity-80">
          <span>{t("prefs.sections.rehabSection.protocolLabel")}</span>
          <TooltipIcon text={t("prefs.sections.rehabSection.protocolTooltip")} />
        </div>

        <TextField
          label=""
          placeholder={t("prefs.sections.rehabSection.protocolPlaceholder")}
          value={rf.recovery_protocol ?? ""}
          onChange={(e) =>
            setRehab({
              recovery_protocol: (e.target as HTMLInputElement).value || null,
            })
          }
        />
      </div>
    </InputsCard>
  );
}