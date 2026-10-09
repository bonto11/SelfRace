"use client";

/*
 * Spoločné prvky všetkých widgetov (activity, coach, recovery, performance).
 * Každý widget má rovnakú kostru:
 *   1) Hero – jedno veľké číslo (+ ikona vľavo, krátky štítok vpravo)
 *   2) jeden jednoduchý obrázok (stĺpce, pruh, stupnica, zoznam)
 *   3) najviac jeden tichý riadok dole
 * Všetko vysvetľovanie je pod „i“ (tooltip widgetu aj detailu) – widget
 * má byť čitateľný na prvý pohľad, nie návod.
 *
 * Stav má vždy farbu AJ ikonu/text – nikdy len farbu.
 */

import type { ReactNode } from "react";
import type * as React from "react";
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
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { StatusMark, type MarkKind } from "@/app/shared/ui/components/StatusMark";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";

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
      className={WK.pill}
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

/**
 * hlavné číslo: hodnota + jednotka, pod ním krátky popis, vpravo štítok.
 * size="md" pre text namiesto čísla (cieľ, názov tréningu).
 */
export function Hero({
  value,
  unit,
  sub,
  icon,
  right,
  size = "lg",
}: {
  value: ReactNode;
  unit?: string;
  sub?: string;
  icon?: ReactNode;
  right?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className={size === "md" ? WK.heroValueMd : WK.heroValue}
              style={{ color: appColors.textPrimary }}
            >
              {value}
            </span>
            {unit ? (
              <span className={WK.heroUnit} style={{ color: appColors.textSecondary }}>
                {unit}
              </span>
            ) : null}
          </div>
          {sub ? (
            <div className={WK.heroSub} style={{ color: appColors.textMuted }}>
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
    <div className={WK.caption} style={{ color: appColors.textMuted }}>
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
  colors,
  max: maxIn,
  band,
}: {
  values: number[];
  ghost?: number[];
  labels: string[];
  color: string;
  /** farba po stĺpcoch (napr. podľa pásma) – inak `color` */
  colors?: (string | null)[];
  /** pevné maximum osi (inak najvyšší stĺpec) */
  max?: number;
  /** odporúčané pásmo [od, do] ako jemný podklad za stĺpcami */
  band?: [number, number];
}) {
  const max = maxIn ?? Math.max(1, ...values, ...(ghost ?? []));
  return (
    <div className="flex gap-1.5 h-14">
      {values.map((v, i) => {
        const g = ghost?.[i] ?? 0;
        return (
          // h-full: výška v % u stĺpčekov potrebuje pevnú výšku rodiča
          <div key={i} className="flex-1 h-full flex flex-col items-center gap-1 min-w-0">
            <div className="relative w-full flex-1 flex items-end justify-center">
              {band ? (
                <div
                  className="absolute -left-[3px] -right-[3px]"
                  style={{
                    bottom: `${(Math.min(band[0], max) / max) * 100}%`,
                    height: `${((Math.min(band[1], max) - Math.min(band[0], max)) / max) * 100}%`,
                    background: tint(appColors.statusSuccess, 0.1),
                  }}
                />
              ) : null}
              {g > 0 ? (
                <div
                  className="absolute bottom-0 w-full rounded-md"
                  style={{ height: `${(g / max) * 100}%`, background: tint(color, 0.16) }}
                />
              ) : null}
              <div
                className="relative w-1/2 rounded-md"
                style={{
                  height: `${Math.min(100, Math.max(v > 0 ? 8 : 0, (v / max) * 100))}%`,
                  background: colors?.[i] ?? color,
                }}
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
      <div className={WK.label} style={{ color: appColors.textMuted }}>
        {label}
      </div>
    </div>
  );
}


/* ===== stavy widgetu (rovnaké všade) ================================== */

export function WidgetLoading() {
  return (
    <div className="grid place-items-center py-6" aria-live="polite">
      <LoadingSpinner size="widget" />
    </div>
  );
}

/** prázdny / chybový stav: ikona + krátka veta, voliteľne niečo pod tým */
export function WidgetEmpty({
  icon,
  text,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  text: string;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} color={toneColor(tone)} />
        <span className="text-sm leading-snug" style={{ color: appColors.textSecondary }}>
          {text}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ===== úroveň low / moderate / high ==================================== */

export type Level = "low" | "moderate" | "high";

/** AI vracia low/moderate/high (staršie aj medium) – nič iné nepúšťaj ďalej */
export function toLevel(v: unknown): Level | null {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("low") || s.startsWith("nízk")) return "low";
  if (s.startsWith("mod") || s.startsWith("med") || s.startsWith("stred")) return "moderate";
  if (s.startsWith("high") || s.startsWith("vysok")) return "high";
  return null;
}

/** pre únavu a riziko: nízke = dobré */
export function levelTone(l: Level | null): Tone {
  return l === "low" ? "good" : l === "moderate" ? "warn" : l === "high" ? "danger" : "neutral";
}

/** malá stupnica 3 dielikov – koľko dielikov svieti, toľko je úroveň */
export function LevelMeter({ label, level, text }: { label: string; level: Level | null; text: string }) {
  const n = level === "low" ? 1 : level === "moderate" ? 2 : level === "high" ? 3 : 0;
  const c = toneColor(levelTone(level));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className={WK.label} style={{ color: appColors.textMuted }}>
          {label}
        </span>
        <span className="text-xs font-semibold truncate" style={{ color: n ? c : appColors.textMuted }}>
          {text}
        </span>
      </div>
      <div className="flex gap-1 mt-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= n ? c : appColors.surfaceCardBorder }}
          />
        ))}
      </div>
    </div>
  );
}

/* ===== AI text: jedno plus, jedno mínus ================================ */

/**
 * Jedna veta z AI s ikonou: good = čo ide dobre, warn = na čo si dať pozor.
 * Najviac 2 riadky – celé znenie je v detaile.
 */
export function Highlight({ tone, text }: { tone: Tone; text: string }) {
  const Icon = tone === "good" ? TrendingUp : TONE_ICON[tone];
  const c = toneColor(tone);
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 mt-px"
        style={{ background: tint(c, 0.16) }}
      >
        <Icon size={12} color={c} />
      </span>
      <span className={`${WK.body} line-clamp-2`} style={{ color: appColors.textSecondary }}>
        {text}
      </span>
    </div>
  );
}

/** hlavná veta AI (headline) – najviac 2 riadky */
export function Headline({ children }: { children: ReactNode }) {
  return (
    <p className={WK.headline} style={{ color: appColors.textPrimary }}>
      {children}
    </p>
  );
}

/* ===== deň so značkami (denný widget, malý aj veľký kalendár) ========== */

export type DayMarkItem = { key: string; kind: MarkKind; sport: string };

/**
 * Jeden deň: písmeno dňa (voliteľne), číslo dňa (voliteľne) a pod tým značky
 * stavu (StatusMark). Rovnaký vzhľad v dennom widgete, malom aj veľkom
 * kalendári – dnešok má jemný rámik, vybraný deň rámik vo farbe značky.
 */
export function DayTile({
  label,
  day,
  marks,
  today,
  selected,
  dim,
  limit = 3,
  markSize = "sm",
  emptyDot,
  titles,
  onClick,
  minH,
  badge,
  badgeTitle,
}: {
  label?: string;
  day?: number | null;
  marks: DayMarkItem[];
  today?: boolean;
  selected?: boolean;
  /** deň mimo zobrazeného mesiaca */
  dim?: boolean;
  limit?: number;
  markSize?: "xs" | "sm";
  /** bodka pri prázdnom dni = voľno (denný widget) */
  emptyDot?: boolean;
  titles?: Partial<Record<MarkKind, string>>;
  onClick?: () => void;
  minH?: number;
  /** bodka v rohu – napr. neprečítaná správa k tréningu v ten deň */
  badge?: boolean;
  badgeTitle?: string;
}) {
  const ring = selected
    ? `inset 0 0 0 1.5px ${appColors.brandPrimary}`
    : today
      ? `inset 0 0 0 1px ${appColors.textMuted}`
      : "none";
  const shown = marks.slice(0, limit);
  const body = (
    <>
      {badge ? (
        <span
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ background: appColors.brandPrimary }}
          title={badgeTitle}
          aria-label={badgeTitle}
        />
      ) : null}
      {label ? (
        <span
          className="text-[9px] leading-none uppercase"
          style={{ color: today ? appColors.textPrimary : appColors.textMuted, fontWeight: today ? 700 : 400 }}
        >
          {label}
        </span>
      ) : null}
      {day != null ? (
        <span
          className="text-sm leading-none tabular-nums"
          style={{ color: today ? appColors.textPrimary : appColors.textSecondary, fontWeight: today ? 700 : 600 }}
        >
          {day}
        </span>
      ) : null}
      <span className="flex flex-wrap justify-center items-center gap-0.5 min-h-[14px]">
        {shown.length ? (
          shown.map((m) => <StatusMark key={m.key} kind={m.kind} sport={m.sport} size={markSize} title={titles?.[m.kind]} />)
        ) : emptyDot ? (
          <span className="w-1 h-1 rounded-full" style={{ background: appColors.surfaceCardBorder }} />
        ) : null}
        {marks.length > shown.length ? (
          <span className="text-[9px] leading-none" style={{ color: appColors.textMuted }}>
            +{marks.length - shown.length}
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = "relative flex flex-col items-center gap-1 rounded-xl py-1.5 px-0.5 min-w-0 w-full select-none";
  const style: React.CSSProperties = {
    background: selected || today ? tint(appColors.textPrimary, 0.06) : "transparent",
    boxShadow: ring,
    opacity: dim ? 0.4 : 1,
    minHeight: minH,
    WebkitTapHighlightColor: "transparent",
  };
  return onClick ? (
    <button
      type="button"
      className={`${cls} transition-[background,box-shadow] duration-150 focus:outline-none`}
      style={style}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

/** riadok skratiek dní nad mriežkou (po … ne) */
export function DowRow({ labels }: { labels: string[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {labels.map((l, i) => (
        <span key={i} className="text-[10px] uppercase tracking-wide text-center" style={{ color: appColors.textMuted }}>
          {l}
        </span>
      ))}
    </div>
  );
}

/** legenda značiek – rovnaké poradie všade */
export function MarkLegend({ titles }: { titles: Record<MarkKind, string> }) {
  const order: MarkKind[] = ["plan", "done", "missed", "postponed", "activity"];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {order.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 text-[11px]" style={{ color: appColors.textMuted }}>
          <StatusMark kind={k} sport="run" size="xs" />
          {titles[k]}
        </span>
      ))}
    </div>
  );
}

export type StripDay = {
  key: string;
  label: string;
  day?: number;
  marks: DayMarkItem[];
  today?: boolean;
  titles?: Partial<Record<MarkKind, string>>;
};

/** 7 dní vedľa seba (denný widget) – DayTile s bodkou pre voľno */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => (
        <DayTile key={d.key} label={d.label} day={d.day} marks={d.marks} today={d.today} titles={d.titles} emptyDot />
      ))}
    </div>
  );
}

/* ===== plnenie: skutočnosť / plán ====================================== */

export function ProgressRow({
  label,
  done,
  total,
  color,
  value,
  icon,
}: {
  label: string;
  done: number;
  total: number;
  color: string;
  value: string;
  icon?: ReactNode;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : done > 0 ? 100 : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 min-w-0 text-xs truncate" style={{ color: appColors.textSecondary }}>
          {icon}
          {label}
        </span>
        <span className="text-xs tabular-nums shrink-0" style={{ color: appColors.textMuted }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: appColors.surfaceCardBorder }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}


/* ===== krivka za posledné dni ========================================== */

const DAY_MS = 86_400_000;

/**
 * Krivka hodnôt v čase. Prerušovaná čiara = tvoj priemer, bodka = posledné meranie.
 *
 * - `values`: denné hodnoty (recovery) – rovnaké rozostupy.
 * - `points`: riedke merania s dátumom (váha, tuk, VO2max) – os je čas od
 *   prvého merania po dnešok, body sa spoja a posledná hodnota sa drží až
 *   po dnešok (platí, kým nepríde nové meranie). Jedno meranie = vodorovná čiara.
 *   `hold={false}` pre denné merania – bez dnešného merania čiara končí pri poslednom dni.
 */
export function Sparkline({
  values,
  points,
  color,
  baseline,
  height = 40,
  hold = true,
}: {
  values?: number[];
  points?: { date: string; value: number }[];
  hold?: boolean;
  color: string;
  baseline?: number | null;
  height?: number;
}) {
  // [x 0..1, hodnota]
  let xy: [number, number][] = [];
  let tail: [number, number] | null = null;
  if (points?.length) {
    const sorted = [...points]
      .map((p) => ({ t: new Date(p.date).getTime(), v: p.value }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
    if (sorted.length) {
      const t0 = sorted[0].t;
      const t1 = Math.max(Date.now(), sorted[sorted.length - 1].t);
      const span = Math.max(DAY_MS, t1 - t0);
      xy = sorted.map((p) => [(p.t - t0) / span, p.v]);
      const last = xy[xy.length - 1];
      if (hold || xy.length === 1) tail = [1, last[1]];
    }
  } else if (values && values.length >= 2) {
    xy = values.map((v, i) => [i / (values.length - 1), v]);
  }
  if (!xy.length) return null;

  const W = 100;
  const H = height;
  const pad = 5;
  const all = [...xy.map((p) => p[1]), ...(baseline != null ? [baseline] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  // jedna hodnota (alebo všetky rovnaké) = čiara v strede, nie pri okraji
  const y = (v: number) => (max === min ? H / 2 : pad + (1 - (v - min) / range) * (H - pad * 2));
  const line = [...xy, ...(tail ? [tail] : [])].map(([x, v]) => [x * W, y(v)] as const);
  const lineStr = line.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  const area = `${line[0][0].toFixed(2)},${H} ${lineStr} ${line[line.length - 1][0].toFixed(2)},${H}`;
  const [lx, lv] = xy[xy.length - 1];
  const showDots = !!points && xy.length <= 14;

  return (
    <div className="relative" style={{ height: H }}>
      {/* výška v štýle: globálne CSS dáva svg height:auto a krivka by narástla podľa šírky */}
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block overflow-visible"
        style={{ height: H, width: "100%" }}
      >
        <polygon points={area} fill={tint(color, 0.12)} />
        {baseline != null ? (
          <line
            x1={0}
            x2={W}
            y1={y(baseline)}
            y2={y(baseline)}
            stroke={appColors.textMuted}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <polyline
          points={lineStr}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* bodky mimo SVG – pri preserveAspectRatio="none" by sa kruh roztiahol */}
      {showDots
        ? xy.slice(0, -1).map(([x, v], i) => (
            <span
              key={i}
              className="absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
              style={{ left: `${x * 100}%`, top: y(v), background: color }}
            />
          ))
        : null}
      <span
        className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full"
        style={{ left: `${lx * 100}%`, top: y(lv), background: color, border: `2px solid ${appColors.surfaceSolid}` }}
      />
    </div>
  );
}

/* ===== 5 zón vedľa seba ================================================ */

export function ZoneColumns({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((z, i) => (
        <div key={i} className="min-w-0 flex flex-col gap-1">
          <div className="h-1.5 rounded-full" style={{ background: z.color }} />
          <div className={WK.label} style={{ color: appColors.textMuted }}>
            {z.label}
          </div>
          <div className="text-xs font-semibold tabular-nums truncate" style={{ color: appColors.textPrimary }}>
            {z.value}
          </div>
        </div>
      ))}
    </div>
  );
}
