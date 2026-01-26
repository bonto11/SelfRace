// src/features/coach/components/prefs/PlanStartSection.tsx
"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import { toast } from "@/app/shared/ui/components/Toast";

import { appColors } from "@/app/shared/theme/app_colors";
import {
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  SECTION,
  SECTION_STYLE,
  FORM_GRID_SPLIT,
} from "@/app/shared/ui/tokens";

/* ---------------- date helpers (noon to avoid TZ weirdness) ---------------- */
function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

function parseISO(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addWeeksISO(startISO: string, weeks: number): string {
  const base = parseISO(startISO);
  if (!base || !Number.isFinite(weeks)) return startISO;
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return toISO(d);
}

function diffWeeks(startISO: string, endISO: string): number | undefined {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return undefined;
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return 1;
  const weeks = ms / (7 * 24 * 60 * 60 * 1000);
  return Math.max(1, Math.round(weeks));
}

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function PlanStartSection({ local, setLocal, markDirty }: Props) {
  const [open, setOpen] = useState(true);

  const minStart = MIN_PLAN_START();
  const start = (local.start_date as string | undefined) ?? "";
  const end = (local.end_date as string | undefined) ?? "";
  const weeksVal =
    local.weeks != null && !Number.isNaN(local.weeks)
      ? String(local.weeks)
      : "";

  const applyStart = (nextStart: string) => {
    markDirty();
    setLocal((prev) => {
      const base = { ...prev, start_date: nextStart || null };

      if (base.weeks && Number(base.weeks) > 0) {
        return {
          ...base,
          end_date: addWeeksISO(nextStart, Number(base.weeks)),
        };
      }

      if (base.end_date) {
        const w = diffWeeks(nextStart, base.end_date);
        return { ...base, weeks: w };
      }

      return base;
    });
  };

  const applyEnd = (nextEnd: string) => {
    markDirty();
    setLocal((prev) => {
      const base = { ...prev, end_date: nextEnd || null };
      if (base.start_date && base.end_date) {
        const w = diffWeeks(base.start_date, base.end_date);
        return { ...base, weeks: w };
      }
      return base;
    });
  };

  const applyWeeks = (nextWeeksRaw: string) => {
    markDirty();
    setLocal((prev) => {
      const v = nextWeeksRaw.trim();
      if (!v) return { ...prev, weeks: undefined };

      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return { ...prev, weeks: undefined };

      const weeks = Math.round(n);
      const base = { ...prev, weeks };

      if (base.start_date) {
        return { ...base, end_date: addWeeksISO(base.start_date, weeks) };
      }

      return base;
    });
  };

  const previewText = useMemo(() => {
    const s = start || "—";
    const e = end || "—";
    const w = weeksVal ? `${weeksVal}w` : "—";
    return `${s} · ${e} · ${w}`;
  }, [start, end, weeksVal]);

  const guardStart = (iso: string | null) => {
    const next = iso || "";
    if (next && next < minStart) {
      toast.error(`Start date must be ≥ ${minStart}`);
      applyStart(minStart);
      return;
    }
    applyStart(next);
  };

  return (
    <InputsCard
      title="Plan duration"
      subtitle="Start, end a plánovací horizont (weeks)."
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      always={
        <div className="text-xs" style={{ color: appColors.textMuted }}>
          Min start: {minStart}
        </div>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Start / End */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Start
            </div>
            <DateField value={start || null} onChange={guardStart} />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              End
            </div>
            <DateField
              value={end || null}
              onChange={(v) => applyEnd(v || "")}
            />
          </section>
        </div>

        {/* Weeks + actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Planning horizon (weeks)
            </div>
            <TextField
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={weeksVal}
              onChange={(e) => applyWeeks(e.target.value)}
              placeholder="e.g. 12"
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Quick actions
            </div>
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
                Tomorrow
              </Button>
            </div>
          </section>
        </div>
      </div>
    </InputsCard>
  );
}
