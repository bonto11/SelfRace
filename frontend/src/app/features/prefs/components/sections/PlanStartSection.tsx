// src/features/coach/components/prefs/PlanStartSection.tsx
"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
import NumberField from "@/app/shared/ui/components/NumberField";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT } from "@/app/shared/i18n/useT";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  SECTION,
  SECTION_STYLE,
  FORM_GRID_SPLIT,
} from "@/app/shared/ui/tokens";

/* ---------------- date helpers ---------------- */

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

function parseISO(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function addWeeksISO(startISO: string, weeks: number): string {
  const base = parseISO(startISO);
  if (!base) return startISO;
  const d = new Date(base);
  d.setDate(d.getDate() + weeks * 7);
  return toISO(d);
}

function diffWeeks(startISO: string, endISO: string): number | undefined {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return;
  return Math.max(
    1,
    Math.round((e.getTime() - s.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
}

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function PlanStartSection({ local, setLocal, markDirty }: any) {
  const [open, setOpen] = useState(true);

  const start = local.start_date ?? "";
  const applyStart = (next: string | null) => {
    markDirty();
    setLocal((prev: any) => ({ ...prev, start_date: next || null }));
  };

  const weeksVal =
    local.weeks != null && !Number.isNaN(local.weeks) ? local.weeks : "";
  const applyWeeks = (val: number) => {
    markDirty();
    if (!Number.isFinite(val) || val <= 0) return;
    setLocal((prev: any) => ({ ...prev, weeks: Math.round(val) }));
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>TEST TITLE</span>
          <TooltipIcon text="test tooltip text" />
        </div>
      }
      subtitle="test subtitle"
      preview="test preview"
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <DateField value={start || null} onChange={applyStart} />
      <NumberField
        min={1}
        max={52}
        step={1}
        unit="t"
        value={weeksVal}
        onChange={(val) => val !== "" && applyWeeks(val)}
      />
      <Button size="sm" variant="secondary" onClick={() => applyStart("2026-08-01")}>
        Test tlačidlo
      </Button>
    </InputsCard>
  );
}