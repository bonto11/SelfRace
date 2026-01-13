"use client";

import Button from "@/app/shared/components/ui/Button";
import { SECTION } from "@/app/shared/ui/classes";
import { inputClass } from "@/app/shared/ui";

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

// helpers na prácu s dátumami (všetko na obed, aby neblbli timezóny)
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

// zaokrúhlený počet týždňov medzi dátumami (min 1)
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
  const minStart = MIN_PLAN_START();
  const start = (local.start_date as string | undefined) ?? "";
  const end = (local.end_date as string | undefined) ?? "";
  const weeksVal =
    local.weeks != null && !Number.isNaN(local.weeks) ? String(local.weeks) : "";

  const applyStart = (nextStart: string) => {
    markDirty();
    setLocal((prev) => {
      const base = { ...prev, start_date: nextStart || null };

      // ak už máme weeks, prepočítaj end
      if (base.weeks && Number(base.weeks) > 0) {
        return {
          ...base,
          end_date: addWeeksISO(nextStart, Number(base.weeks)),
        };
      }

      // ak máme end, prepočítaj weeks
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
      if (!v) {
        return { ...prev, weeks: undefined };
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        return { ...prev, weeks: undefined };
      }

      const weeks = Math.round(n);
      const base = { ...prev, weeks };

      // ak máme start_date, dopočítaj end_date
      if (base.start_date) {
        return {
          ...base,
          end_date: addWeeksISO(base.start_date, weeks),
        };
      }

      return base;
    });
  };

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Plan duration</div>
        <div className="text-xs opacity-70">Min start: {minStart}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
        {/* START */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] opacity-70">Start date</label>
          <input
            type="date"
            value={start}
            min={minStart}
            onChange={(e) => applyStart((e.target as HTMLInputElement).value)}
            className={inputClass}
          />
        </div>

        {/* END */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] opacity-70">End date</label>
          <input
            type="date"
            value={end}
            min={start || minStart}
            onChange={(e) => applyEnd((e.target as HTMLInputElement).value)}
            className={inputClass}
          />
        </div>

        {/* WEEKS */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] opacity-70">
            Planning horizon (weeks)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={weeksVal}
            onChange={(e) => applyWeeks((e.target as HTMLInputElement).value)}
            className={inputClass}
            placeholder="e.g. 12"
          />
        </div>
      </div>

      {/* shortcut tlačidlá len pre start_date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => applyStart(DEFAULT_PLAN_START())}
        >
          Set default (D+2)
        </Button>
        <Button
          variant="secondary"
          onClick={() => applyStart(MIN_PLAN_START())}
        >
          Start tomorrow
        </Button>
      </div>
    </section>
  );
}