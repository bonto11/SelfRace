// src/features/coach/components/prefs/PlanStartSection.tsx
"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
// ✅ Import nášho točiaceho bubna
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
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

export function PlanStartSection({ local, setLocal, markDirty }: Props) {
  const t = useT();
  const [open, setOpen] = useState(true);

  const minStart = MIN_PLAN_START();
  const start = local.start_date ?? "";
  const end = local.end_date ?? "";
  const weeksVal =
    local.weeks != null && !Number.isNaN(local.weeks)
      ? String(local.weeks)
      : "";

  const applyStart = (next: string) => {
    markDirty();
    setLocal((prev) => {
      const base = { ...prev, start_date: next || null };

      if (base.weeks) {
        return {
          ...base,
          end_date: addWeeksISO(next, Number(base.weeks)),
        };
      }

      if (base.end_date) {
        return {
          ...base,
          weeks: diffWeeks(next, base.end_date),
        };
      }

      return base;
    });
  };

  const applyEnd = (next: string) => {
    markDirty();
    setLocal((prev) => {
      const base = { ...prev, end_date: next || null };
      if (base.start_date && base.end_date) {
        return {
          ...base,
          weeks: diffWeeks(base.start_date, base.end_date),
        };
      }
      return base;
    });
  };

  const applyWeeks = (val: number) => {
    markDirty();
    if (!Number.isFinite(val) || val <= 0) return;
    setLocal((prev) => ({
      ...prev,
      weeks: Math.round(val),
      end_date: prev.start_date
        ? addWeeksISO(prev.start_date, Math.round(val))
        : prev.end_date,
    }));
  };

  const previewText = useMemo(
    () =>
      `${start || "—"} · ${end || "—"} · ${weeksVal ? `${weeksVal}${t("common.units.weeksAbbrev")}` : "—"}`,
    [start, end, weeksVal, t],
  );

  const guardStart = (iso: string | null) => {
    if (iso && iso < minStart) {
      toast.error(t("prefs.sections.planStartSection.errors.minStart").replace("{{date}}", minStart));
      applyStart(minStart);
      return;
    }
    applyStart(iso || "");
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.planStartSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.planStartSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.planStartSection.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      always={
        <div className="text-xs" style={{ color: appColors.textMuted }}>
          {t("prefs.sections.planStartSection.minStartLabel")}: {minStart}
        </div>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.planStartSection.startLabel")}</div>
            <DateField value={start || null} onChange={guardStart} />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.planStartSection.endLabel")}</div>
            <DateField
              value={end || null}
              onChange={(v) => applyEnd(v || "")}
            />
          </section>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.planStartSection.horizonLabel")}
            </div>
            {/* ✅ Nahradené za NumberWheelField pre výber počtu týždňov */}
            <NumberWheelField
              min={1}
              max={52}
              step={1}
              value={local.weeks != null && !Number.isNaN(local.weeks) ? local.weeks : ""}
              onChange={(val) => applyWeeks(val)}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.planStartSection.quickActionsLabel")}</div>
            <div className={FORM_GRID_SPLIT}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => applyStart(DEFAULT_PLAN_START())}
              >
                D+2
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => applyStart(MIN_PLAN_START())}
              >
                {t("prefs.sections.planStartSection.tomorrow")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </InputsCard>
  );
}