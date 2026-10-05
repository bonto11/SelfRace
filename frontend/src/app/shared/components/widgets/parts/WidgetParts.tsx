"use client";

/*
 * Malé vizuálne prvky widgetov (aktivity). Cieľ: číslo + jednoduchý obrázok
 * + jedna veta, ktorú pochopí aj laik.
 *
 * Stav (dobré / pozor / riziko) má vždy farbu, ikonu AJ text – nikdy len
 * farbu (farboslepí, slnko na displeji).
 */

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export type Tone = "good" | "warn" | "danger" | "info" | "neutral";

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "good":
      return appColors.statusSuccess;
    case "warn":
      return appColors.statusWarning;
    case "danger":
      return appColors.statusError;
    case "info":
      return appColors.statusInfo;
    default:
      return appColors.textSecondary;
  }
}

const TONE_ICON: Record<Tone, typeof Info> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
  neutral: Info,
};

/** stavový štítok: ikona + text v tónovej farbe */
export function StatusChip({ tone, label, icon }: { tone: Tone; label: string; icon?: ReactNode }) {
  const Icon = TONE_ICON[tone];
  const c = toneColor(tone);
  return (
    <span
      className="inline-flex items-start gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold leading-snug max-w-full self-start"
      style={{ color: c, border: `1px solid ${c}`, background: appColors.surfaceSolid }}
    >
      {icon ?? <Icon size={12} className="shrink-0 mt-[2px]" />}
      <span>{label}</span>
    </span>
  );
}

/** zmena oproti minulému obdobiu: šípka + percentá */
export function DeltaChip({ pct, tone, suffix }: { pct: number; tone: Tone; suffix: string }) {
  const c = toneColor(tone);
  const Icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: c }}>
      <Icon size={14} />
      {pct > 0 ? "+" : ""}
      {Math.round(pct)} %<span className="font-normal" style={{ color: appColors.textMuted }}>{suffix}</span>
    </span>
  );
}

/**
 * Stĺpčeky po dňoch (posledných 7 dní). Sivé „duchy“ za nimi sú rovnaké
 * dni minulý týždeň – porovnanie bez čítania čísel.
 */
export function DayBars({
  values,
  ghost,
  labels,
  color,
}: {
  values: number[];
  ghost?: number[];
  labels: string[];
  color: string;
}) {
  const max = Math.max(1, ...values, ...(ghost ?? []));
  return (
    <div className="flex gap-1.5 h-16">
      {values.map((v, i) => {
        const g = ghost?.[i] ?? 0;
        return (
          // h-full: výška v % u stĺpčekov potrebuje pevnú výšku rodiča
          <div key={i} className="flex-1 h-full flex flex-col items-center gap-1 min-w-0">
            <div className="relative w-full flex-1 flex items-end justify-center">
              {g > 0 ? (
                <div
                  className="absolute bottom-0 w-full rounded-t"
                  style={{ height: `${(g / max) * 100}%`, background: appColors.surfaceCardBorder }}
                />
              ) : null}
              <div
                className="relative w-3/5 rounded-t"
                style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%`, background: color }}
              />
            </div>
            <span className="text-[9px] leading-none uppercase" style={{ color: appColors.textMuted }}>
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Stupnica s pásmami a značkou hodnoty (monotónnosť, námaha).
 * zones: horné hranice pásiem vzostupne, posledné pásmo ide do `max`.
 */
export function ZoneMeter({
  value,
  max,
  zones,
}: {
  value: number | null;
  max: number;
  zones: { to: number; tone: Tone }[];
}) {
  let from = 0;
  const pos = value == null ? null : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative pt-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        {zones.map((z, i) => {
          const to = Math.min(max, z.to);
          const w = ((to - from) / max) * 100;
          from = to;
          return <div key={i} style={{ width: `${w}%`, background: toneColor(z.tone), opacity: 0.45 }} />;
        })}
      </div>
      {pos != null ? (
        <div
          className="absolute top-0 w-3.5 h-3.5 -ml-[7px] rounded-full"
          style={{
            left: `${pos * 100}%`,
            top: 2,
            background: appColors.textPrimary,
            border: `3px solid ${appColors.surfaceSolid}`,
          }}
        />
      ) : null}
    </div>
  );
}

/** vodorovný pomer dvoch častí s cieľovou ryskou (80/20) */
export function SplitBar({
  a,
  b,
  colorA,
  colorB,
  targetPct,
}: {
  a: number;
  b: number;
  colorA: string;
  colorB: string;
  targetPct?: number;
}) {
  const total = a + b;
  const pa = total ? (a / total) * 100 : 0;
  return (
    <div className="relative">
      <div className="flex h-3 rounded-full overflow-hidden gap-[2px]">
        <div style={{ width: `${pa}%`, background: colorA }} />
        <div style={{ width: `${100 - pa}%`, background: colorB }} />
      </div>
      {targetPct != null ? (
        <div
          className="absolute -top-1 -bottom-1 w-[2px] rounded"
          style={{ left: `${targetPct}%`, background: appColors.textPrimary }}
        />
      ) : null}
    </div>
  );
}

/** riadok „bodka + text + hodnota“ */
export function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 min-w-0" style={{ color: appColors.textSecondary }}>
        <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-semibold tabular-nums" style={{ color: appColors.textPrimary }}>
        {value}
      </span>
    </div>
  );
}
