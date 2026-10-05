"use client";

/*
 * Spoločné prvky activity widgetov. Každý widget má rovnakú kostru:
 *   1) Hero – jedno veľké číslo (+ ikona vľavo, krátky štítok vpravo)
 *   2) jeden jednoduchý obrázok (stĺpce, pruh, stupnica, zoznam)
 *   3) najviac jeden tichý riadok dole
 * Všetko vysvetľovanie je pod „i“ (tooltip widgetu aj detailu) – widget
 * má byť čitateľný na prvý pohľad, nie návod.
 *
 * Stav má vždy farbu AJ ikonu/text – nikdy len farbu.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bike,
  CheckCircle2,
  Dumbbell,
  Footprints,
  Info,
  Minus,
  Mountain,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";
import { getSportColor } from "@/app/shared/ui/components/SportBadge";
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

/** priesvitná verzia farby – len pre #RRGGBB, inak jemný neutrálny podklad */
export function tint(color: string, alpha: number): string {
  if (/^#[\da-f]{6}$/i.test(color)) {
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  }
  return "rgba(255,255,255,0.06)";
}

const TONE_ICON: Record<Tone, LucideIcon> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
  neutral: Info,
};

/** krátky stavový štítok (1–2 slová): ikona + text na jemnom podklade */
export function Pill({ tone, label, icon }: { tone: Tone; label: string; icon?: LucideIcon }) {
  const Icon = icon ?? TONE_ICON[tone];
  const c = toneColor(tone);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums"
      style={{ color: c, background: tint(c, 0.14) }}
    >
      <Icon size={12} className="shrink-0" />
      {label}
    </span>
  );
}

/** zmena v % ako štítok so šípkou */
export function DeltaPill({ pct, tone }: { pct: number; tone: Tone }) {
  const icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  return <Pill tone={tone} icon={icon} label={`${pct > 0 ? "+" : ""}${Math.round(pct)} %`} />;
}

/** ikona v zaoblenom štvorčeku – vizuálna kotva widgetu */
export function IconTile({
  icon: Icon,
  color,
  small,
  solid,
}: {
  icon: LucideIcon;
  color?: string;
  small?: boolean;
  /** farba ide do podkladu a ikona je svetlá – pre tmavé farby športov (kontrast) */
  solid?: boolean;
}) {
  const c = color ?? appColors.textSecondary;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${small ? "w-7 h-7 rounded-lg" : "w-9 h-9 rounded-xl"}`}
      style={{ background: tint(c, solid ? 0.55 : 0.16) }}
    >
      <Icon size={small ? 15 : 18} color={solid ? appColors.textPrimary : c} />
    </span>
  );
}

const SPORT_ICON: Record<string, LucideIcon> = {
  run: Footprints,
  walk: Footprints,
  ride: Bike,
  bike: Bike,
  swim: Waves,
  strength: Dumbbell,
  mixed: Mountain,
};

/** malá ikona športu vo farbe športu – do zoznamov */
export function SportTile({ sport }: { sport?: string | null }) {
  const key = String(sport || "other").toLowerCase();
  return <IconTile small solid icon={SPORT_ICON[key] ?? Activity} color={getSportColor(key)} />;
}

/** hlavné číslo: hodnota + jednotka, pod ním krátky popis, vpravo štítok */
export function Hero({
  value,
  unit,
  sub,
  icon,
  right,
}: {
  value: ReactNode;
  unit?: string;
  sub?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span
              className="text-3xl font-bold tabular-nums leading-none tracking-tight"
              style={{ color: appColors.textPrimary }}
            >
              {value}
            </span>
            {unit ? (
              <span className="text-sm" style={{ color: appColors.textSecondary }}>
                {unit}
              </span>
            ) : null}
          </div>
          {sub ? (
            <div className="text-[11px] mt-1 truncate" style={{ color: appColors.textMuted }}>
              {sub}
            </div>
          ) : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/** tichý riadok na spodku widgetu */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] truncate" style={{ color: appColors.textMuted }}>
      {children}
    </div>
  );
}

/** bodka + text (+ hodnota) – inline legenda */
export function Dot({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 text-[11px]" style={{ color: appColors.textMuted }}>
      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="truncate">{label}</span>
      {value ? (
        <span className="font-semibold tabular-nums" style={{ color: appColors.textSecondary }}>
          {value}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Stĺpčeky po dňoch. Svetlé „duchy“ za nimi sú rovnaké dni minulý týždeň
 * – porovnanie bez čítania čísel (vysvetlené v tooltipe).
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
    <div className="flex gap-1.5 h-14">
      {values.map((v, i) => {
        const g = ghost?.[i] ?? 0;
        return (
          // h-full: výška v % u stĺpčekov potrebuje pevnú výšku rodiča
          <div key={i} className="flex-1 h-full flex flex-col items-center gap-1 min-w-0">
            <div className="relative w-full flex-1 flex items-end justify-center">
              {g > 0 ? (
                <div
                  className="absolute bottom-0 w-full rounded-md"
                  style={{ height: `${(g / max) * 100}%`, background: tint(color, 0.16) }}
                />
              ) : null}
              <div
                className="relative w-1/2 rounded-md"
                style={{ height: `${Math.max(v > 0 ? 8 : 0, (v / max) * 100)}%`, background: color }}
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
    <div className="relative h-3.5 flex items-center">
      <div className="flex w-full h-1.5 rounded-full overflow-hidden gap-[2px]">
        {zones.map((z, i) => {
          const to = Math.min(max, z.to);
          const w = ((to - from) / max) * 100;
          from = to;
          return <div key={i} style={{ width: `${w}%`, background: tint(toneColor(z.tone), 0.45) }} />;
        })}
      </div>
      {pos != null ? (
        <div
          className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full"
          style={{
            left: `${pos * 100}%`,
            background: appColors.textPrimary,
            border: `3px solid ${appColors.surfaceSolid}`,
          }}
        />
      ) : null}
    </div>
  );
}

/** vodorovný pruh z viacerých častí (podiel času), voliteľne s cieľovou ryskou */
export function StackBar({
  parts,
  targetPct,
}: {
  parts: { value: number; color: string }[];
  targetPct?: number;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="relative">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" style={{ background: appColors.surfaceCardBorder }}>
        {total > 0
          ? parts.map((p, i) =>
              p.value > 0 ? (
                <div key={i} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
              ) : null,
            )
          : null}
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

/** dieliky do cieľa (napr. 2/3 tréningov) */
export function Segments({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: Math.max(1, total) }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-2 rounded-full"
          style={{ background: i < done ? color : appColors.surfaceCardBorder }}
        />
      ))}
    </div>
  );
}

/** riadok zoznamu: ikona, názov, hodnota vpravo – rovnaký vo všetkých zoznamoch */
export function ListRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm font-medium truncate" style={{ color: appColors.textPrimary }}>
          {label}
        </span>
      </span>
      {value ? (
        <span className="text-xs tabular-nums shrink-0" style={{ color: appColors.textSecondary }}>
          {value}
        </span>
      ) : null}
    </>
  );
  const cls = "flex items-center justify-between gap-2 w-full rounded-xl px-2.5 py-2 text-left";
  const style = { background: tint(appColors.textPrimary, 0.05) };
  return onClick ? (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={(e) => {
        // riadok má vlastný cieľ – neotvárať aj detail celého widgetu
        e.stopPropagation();
        onClick();
      }}
    >
      {inner}
    </button>
  ) : (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/** malá štatistika: hodnota nad popisom (mriežka 3 vedľa seba) */
export function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-base font-bold tabular-nums leading-tight truncate" style={{ color: appColors.textPrimary }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide truncate" style={{ color: appColors.textMuted }}>
        {label}
      </div>
    </div>
  );
}
