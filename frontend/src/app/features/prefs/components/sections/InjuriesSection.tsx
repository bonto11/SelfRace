// src/features/coach/components/InjuriesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import InputsCard from "@/app/shared/components/ui/InputsCard";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

import { appColors } from "@/app/shared/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

import type {
  Injury,
  InjuryArea,
  InjuryType,
} from "@/app/features/prefs/types/prefs";

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
  const [open, setOpen] = useState(false);

  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "",
  });

  const list = (local.injuries ?? []) as Injury[];

  const preview = useMemo(
    () => list.map((i) => `${i.area} — ${i.type}`),
    [list]
  );

  const previewNode =
    preview.length === 0 ? (
      <span className="opacity-70">No injuries recorded</span>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {preview.map((txt, idx) => (
          <span
            key={`${txt}-${idx}`}
            className="px-1.5 py-0.5 rounded border border-white/15/50 bg-white/5 text-[10px] tracking-wide"
          >
            {txt}
          </span>
        ))}
      </div>
    );

  return (
    <InputsCard
      title="Injuries / limitations"
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          Planner zníži rizikové prvky a doplní kompenzácie.
        </span>
      }
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
      always={
        <div className="flex items-start justify-end">
          <InfoPopover text="Planner reduces risky elements and adds compensations." />
        </div>
      }
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Draft row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* AREA */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="text-xs font-medium opacity-80 mb-2">Area</div>
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
                    {a}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* TYPE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="text-xs font-medium opacity-80 mb-2">Type</div>
            <div className="flex flex-wrap gap-2">
              {INJ_TYPES.map((t) => {
                const active = injDraft.type === t;
                return (
                  <Button
                    key={t}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={active}
                    onClick={() => setInjDraft((d) => ({ ...d, type: t }))}
                    className="text-xs"
                  >
                    {t}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* NOTE */}
          <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <TextField
              label="Note"
              placeholder="e.g., foot pain after long runs"
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

        {/* Actions */}
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
            Add injury
          </Button>
        </div>

        {/* List */}
        {list.length > 0 && (
          <ul className="mt-2 space-y-2">
            {list.map((it, idx) => (
              <li
                key={`${it.area}-${it.type}-${idx}`}
                className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 flex items-center justify-between gap-3"
              >
                <span className="text-sm">
                  {it.area} · {it.type}
                  {it.note ? ` — ${it.note}` : ""}
                </span>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    setLocal((p: any) => ({
                      ...p,
                      injuries: (p.injuries ?? []).filter(
                        (_: any, i: number) => i !== idx
                      ),
                    }))
                  }
                >
                  remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InputsCard>
  );
}