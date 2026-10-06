/*
 * Spoločné výpočty a texty pod „i“ pre recovery widgety (vzor coachInfo).
 */
import { useMemo } from "react";
import type { useT } from "@/app/shared/i18n/useT";
import { checkRecoveryFreshness } from "@/app/shared/utils/recovery";

type T = ReturnType<typeof useT>;

export type RecoveryInfoKey = "readiness" | "hrv" | "rhr" | "sleepDuration" | "sleepStart";

export function recoveryInfo(t: T, key: RecoveryInfoKey): string {
  return t(`recoveryWidgets.info.${key}` as any);
}

export type Series = {
  /** posledných 14 dní (vrátane null = bez merania), od najstaršieho */
  days: { date: string; value: number | null }[];
  /** dnešná hodnota; null keď dnes meranie chýba */
  today: number | null;
  /**
   * Priemer 14 dní BEZ dneška – dnešok sa porovnáva s normálom, nesmie ho
   * sám posúvať. Od 3 meraní, menej je náhoda.
   */
  baseline: number | null;
};

export function useRecoverySeries(rows: any[], pick: (r: any) => number | null): Series {
  return useMemo(() => {
    const all = rows.map((r) => {
      const v = pick(r);
      return { date: String(r.date ?? "").slice(0, 10), value: typeof v === "number" && Number.isFinite(v) ? v : null };
    });
    const days = all.slice(-14);
    const fresh = checkRecoveryFreshness(rows, (r: any) => r.date);
    const last = all.at(-1)?.value ?? null;
    const today = fresh.hasToday ? last : null;
    const prev = (fresh.hasToday ? all.slice(0, -1) : all)
      .map((d) => d.value)
      .filter((v): v is number => v != null)
      .slice(-14);
    const baseline = prev.length >= 3 ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
    return { days, today, baseline };
    // pick je vždy čistá funkcia na jedno pole
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
}

/** „7 h 05“ – dĺžka spánku */
export function fmtSleep(min: number | null): string {
  if (min == null) return "—";
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** „23:10“ z minút od polnoci (aj > 24 h) */
export function fmtClock(min: number | null): string {
  if (min == null) return "—";
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function weekdayNarrow(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale, { weekday: "narrow" });
}
