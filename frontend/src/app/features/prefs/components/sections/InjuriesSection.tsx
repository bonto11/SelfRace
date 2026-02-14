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

const INJ_SEVERITY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 1 = mierne, 10 = neznesiteľné

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
    severity: 3, // Predvolená vážnosť
    note: "",
  });

  const list = (local.injuries ?? []) as Injury[];

  // V náhľade zobrazíme oblasť a vážnosť, napr. "Chodidlo (4/10)"
  const previewLabels = useMemo(() => 
    list.map((i) => `${t(`prefs.sections.injuriesSection.areas.${i.area}` as any)} (${i.severity || "?"}/10)`), 
  [list, t]);

  const previewNode =
    previewLabels.length === 0 ? (
      <span className="opacity-70">{t("prefs.sections.injuriesSection.noInjuries" as any)}</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {previewLabels.map((txt: string, idx: number) => (
          <span
            key={`${txt}-${idx}`}
            className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-[10px] font-bold tracking-wide"
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
          <span>{t("prefs.sections.injuriesSection.widget.title" as any)}</span>
          <TooltipIcon text={t("prefs.sections.injuriesSection.widget.tooltip" as any)} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.injuriesSection.subtitle" as any)}
        </span>
      }
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Zmenené na md:grid-cols-2 pre lepšie rozloženie 4 prvkov */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* AREA */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.areaLabel" as any)}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.areaTooltip" as any)} />
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
                    {t(`prefs.sections.injuriesSection.areas.${a}` as any)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* TYPE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.typeLabel" as any)}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.typeTooltip" as any)} />
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
                    {t(`prefs.sections.injuriesSection.types.${ty}` as any)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* SEVERITY (Vážnosť) */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">
                {t("prefs.sections.injuriesSection.severityLabel" as any) || "Vážnosť bolesti (1-10)"}
              </div>
              <div className="text-[10px] opacity-40">1 = mierna, 10 = extrémna</div>
            </div>

            <div className="flex gap-1">
              {INJ_SEVERITY.map((num) => {
                // Farebné odlíšenie podľa vážnosti
                let colorClass = "bg-black/30 border-white/10 text-white/70 hover:bg-white/10";
                if (injDraft.severity === num) {
                  if (num <= 3) colorClass = "bg-emerald-500 border-emerald-500 text-black font-bold";
                  else if (num <= 6) colorClass = "bg-yellow-500 border-yellow-500 text-black font-bold";
                  else colorClass = "bg-red-500 border-red-500 text-white font-bold";
                }
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setInjDraft((d) => ({ ...d, severity: num }))}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${colorClass}`}
                  >
                    {num}
                  </button>
                )
              })}
            </div>
          </div>

          {/* NOTE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium opacity-80">{t("prefs.sections.injuriesSection.noteLabel" as any)}</div>
              <TooltipIcon text={t("prefs.sections.injuriesSection.noteTooltip" as any)} />
            </div>

            <TextField
              label=""
              placeholder={t("prefs.sections.injuriesSection.notePlaceholder" as any)}
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
            onClick={() => {
              setLocal((p: any) => ({
                ...p,
                injuries: [
                  ...(p.injuries ?? []),
                  { ...injDraft, note: injDraft.note?.trim() || undefined },
                ],
              }));
              // Reset draftu po pridaní
              setInjDraft({ area: "foot", type: "overuse", severity: 3, note: "" });
            }}
          >
            {t("prefs.sections.injuriesSection.addBtn" as any)}
          </Button>
        </div>

        {list.length > 0 && (
          <ul className="mt-2 space-y-2">
            {list.map((it: Injury, idx: number) => (
              <li
                key={`${it.area}-${it.type}-${idx}`}
                className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {t(`prefs.sections.injuriesSection.areas.${it.area}` as any)} · {t(`prefs.sections.injuriesSection.types.${it.type}` as any)}
                  </div>
                  <div className="text-xs mt-1 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      (it.severity || 0) <= 3 ? "bg-emerald-500/20 text-emerald-300" :
                      (it.severity || 0) <= 6 ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"
                    }`}>
                      Vážnosť: {it.severity || "?"}/10
                    </span>
                    {it.note && <span className="opacity-60">{it.note}</span>}
                  </div>
                </div>

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
                  {t("prefs.sections.injuriesSection.removeBtn" as any)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InputsCard>
  );
}
