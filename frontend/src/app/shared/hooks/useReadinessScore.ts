// src/app/shared/hooks/useReadinessScore.ts
import { useMemo } from "react";

export type ReadinessComponents = {
  hrv:     { score: number | null; today: number | null; baseline: number | null };
  rhr:     { score: number | null; today: number | null; baseline: number | null };
  sleep:   { score: number | null; today: number | null };
  factors: { score: number; alcohol: boolean; caffeine: boolean; food: boolean };
};

export type ReadinessResult = {
  score:      number | null;
  label:      string;
  components: ReadinessComponents;
  hasEnough:  boolean;
};

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}
function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function scoreHRV(today: number | null, baseline: number | null): number | null {
  if (today === null || baseline === null || baseline === 0) return null;
  return clamp(Math.round((today / baseline) * 100));
}

function scoreRHR(today: number | null, baseline: number | null): number | null {
  if (today === null || baseline === null || today === 0) return null;
  return clamp(Math.round((baseline / today) * 100));
}

function scoreSleep(minutes: number | null): number | null {
  if (minutes === null) return null;
  if (minutes > 540) return Math.max(75, 100 - Math.round(((minutes - 540) / 30) * 5));
  if (minutes >= 480) return 100;
  if (minutes >= 420) return Math.round(80 + ((minutes - 420) / 60) * 20);
  if (minutes >= 360) return Math.round(50 + ((minutes - 360) / 60) * 30);
  if (minutes >= 240) return clamp(Math.round((minutes / 360) * 50));
  return 0;
}

function scoreFactors(alcohol: boolean, caffeine: boolean, food: boolean): number {
  let s = 100;
  if (alcohol)  s -= 30;
  if (caffeine) s -= 15;
  if (food)     s -= 10;
  return Math.max(0, s);
}

function compose(
  hrv: number | null, rhr: number | null,
  sleep: number | null, factors: number,
): number | null {
  const W = { hrv: 0.40, rhr: 0.30, sleep: 0.20, factors: 0.10 };
  let total = 0, totalW = 0;
  if (hrv   !== null) { total += hrv   * W.hrv;   totalW += W.hrv; }
  if (rhr   !== null) { total += rhr   * W.rhr;   totalW += W.rhr; }
  if (sleep !== null) { total += sleep * W.sleep; totalW += W.sleep; }
  total += factors * W.factors;
  totalW += W.factors;
  if (hrv === null && rhr === null) return null;
  return clamp(Math.round(total / totalW));
}

export function readinessLabelKey(score: number | null): string {
  if (score === null) return "readiness.label.none";
  if (score >= 85) return "readiness.label.excellent";
  if (score >= 70) return "readiness.label.good";
  if (score >= 55) return "readiness.label.average";
  if (score >= 40) return "readiness.label.low";
  return "readiness.label.rest";
}

export function readinessColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 85) return "#4ade80";
  if (score >= 70) return "#86efac";
  if (score >= 55) return "#facc15";
  if (score >= 40) return "#fb923c";
  return "#f87171";
}

/** ISO dátum dnešného dňa v lokálnom čase: "2026-06-10" */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useReadinessScore(rows: any[]): ReadinessResult {
  return useMemo(() => {
    const empty: ReadinessResult = {
      score: null, label: readinessLabelKey(null), hasEnough: false,
      components: {
        hrv:     { score: null, today: null, baseline: null },
        rhr:     { score: null, today: null, baseline: null },
        sleep:   { score: null, today: null },
        factors: { score: 100, alcohol: false, caffeine: false, food: false },
      },
    };

    if (!rows.length) return empty;

    const last = rows.at(-1);
    if (!last) return empty;

    // ── Kľúčová kontrola: posledný záznam musí byť dnešný ──
    const lastDate = String(last.date ?? "").slice(0, 10);
    if (lastDate !== todayIso()) return empty;

    // Baseline z posledných 14 záznamov (vrátane dnešného)
    const nums_hrv = rows
      .map((r) => r.HRV_avg_ms)
      .filter((v): v is number => typeof v === "number");
    const nums_rhr = rows
      .map((r) => r.RHR_bpm)
      .filter((v): v is number => typeof v === "number");

    const baseline_hrv = nums_hrv.length >= 3
      ? Math.round(avg(nums_hrv.slice(-14))) : null;
    const baseline_rhr = nums_rhr.length >= 3
      ? Math.round(avg(nums_rhr.slice(-14))) : null;

    const todayHRV   = typeof last.HRV_avg_ms        === "number" ? last.HRV_avg_ms : null;
    const todayRHR   = typeof last.RHR_bpm            === "number" ? last.RHR_bpm   : null;
    const todaySleep = typeof last.sleep_duration_min === "number" ? last.sleep_duration_min : null;

    const alcohol  = !!last.alcohol_consumed;
    const caffeine = !!last.caffeine_8h;
    const food     = !!last.food_2h_before;

    const hrv_s     = scoreHRV(todayHRV, baseline_hrv);
    const rhr_s     = scoreRHR(todayRHR, baseline_rhr);
    const sleep_s   = scoreSleep(todaySleep);
    const factors_s = scoreFactors(alcohol, caffeine, food);
    const score     = compose(hrv_s, rhr_s, sleep_s, factors_s);

    return {
      score,
      label:     readinessLabelKey(score),
      hasEnough: score !== null,
      components: {
        hrv:     { score: hrv_s,     today: todayHRV,   baseline: baseline_hrv },
        rhr:     { score: rhr_s,     today: todayRHR,   baseline: baseline_rhr },
        sleep:   { score: sleep_s,   today: todaySleep },
        factors: { score: factors_s, alcohol, caffeine, food },
      },
    };
  }, [rows]);
}