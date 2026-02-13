// src/features/coach/components/InjuriesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import type { Injury, InjuryArea, InjuryType } from "@/app/features/prefs/types/prefs";

const INJ_AREAS: InjuryArea[] = [
  "foot",
  "ankle",
  "shin",
  "knee",
  "hip",
  "hamstring",
  "calf",
  "back",
  "shoulder",
  "other",
];

const INJ_TYPES: InjuryType[] = [
  "overuse",
  "acute",
  "tendon",
  "stress",
  "shin_splints",
  "plantar",
  "itb",
  "other",
];

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
};

export function InjuriesSection({ local, setLocal }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "",
  });

  const list = (local.injuries ?? []) as Injury[];

  const previewLabels = useMemo(() => 
    list.map((i) => `${t(`prefs.sections.injuriesSection.areas.${i.area}`)} — ${t(`prefs.sections.injuriesSection.types.${i.type}`)}`), 
  [list, t]);

  const previewNode =
    previewLabels.length === 0 ? (
      <span className="opacity-70">{t("prefs.sections.injuriesSection.noInjuries")}</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {previewLabels.map((txt: string, idx: number) => (
          <span
            key={`${txt}-${idx}`}
            className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-[10px] tracking-wide"
          >
            {txt}
          </span>
        ))}
      </div>
    );

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.injuriesSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.injuriesSection.widget.tooltip")} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.injuriesSection.subtitle")}
        </span>
      }
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* AREA */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.areaLabel")}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.areaTooltip")} />
            </div>

            <div className="flex flex-wrap gap-2">
              {INJ_AREAS.map((a) => {
                const active = injDraft.area === a;
                return (
                  <Button
                    key={a}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={active}
                    onClick={() => setInjDraft((d) => ({ ...d, area: a }))}
                    className="text-xs"
                  >
                    {t(`prefs.sections.injuriesSection.areas.${a}`)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* TYPE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.typeLabel")}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.typeTooltip")} />
            </div>

            <div className="flex flex-wrap gap-2">
              {INJ_TYPES.map((ty) => {
                const active = injDraft.type === ty;
                return (
                  <Button
                    key={ty}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={active}
                    onClick={() => setInjDraft((d) => ({ ...d, type: ty }))}
                    className="text-xs"
                  >
                    {t(`prefs.sections.injuriesSection.types.${ty}`)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* NOTE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.noteLabel")}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.noteTooltip")} />
            </div>

            <TextField
              label=""
              placeholder={t("prefs.sections.injuriesSection.notePlaceholder")}
              value={injDraft.note ?? ""}
              onChange={(e) =>
                setInjDraft((d) => ({
                  ...d,
                  note: (e.target as HTMLInputElement).value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-1">
          <Button
            size="sm"
            variant="success"
            onClick={() =>
              setLocal((p: any) => ({
                ...p,
                injuries: [
                  ...(p.injuries ?? []),
                  { ...injDraft, note: injDraft.note?.trim() || undefined },
                ],
              }))
            }
          >
            {t("prefs.sections.injuriesSection.addBtn")}
          </Button>
        </div>

        {list.length > 0 && (
          <ul className="mt-2 space-y-2">
            {list.map((it: Injury, idx: number) => (
              <li
                key={`${it.area}-${it.type}-${idx}`}
                className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 flex items-center justify-between gap-3"
              >
                <span className="text-sm">
                  {t(`prefs.sections.injuriesSection.areas.${it.area}`)} · {t(`prefs.sections.injuriesSection.types.${it.type}`)}
                  {it.note ? ` — ${it.note}` : ""}
                </span>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    setLocal((p: any) => ({
                      ...p,
                      injuries: (p.injuries ?? []).filter((_: any, i: number) => i !== idx),
                    }))
                  }
                >
                  {t("prefs.sections.injuriesSection.removeBtn")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InputsCard>
  );
}