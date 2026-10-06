"use client";

/*
 * Spoločná karta trendu (regenerácia aj výkon).
 *
 * PREČO vlastné ťukanie/ťahanie namiesto Recharts Tooltipu:
 *  - plávajúca bublina na telefóne zakrývala graf a prst,
 *  - na celej obrazovke sa graf otáča o 90° (CSS rotate) a Recharts by
 *    v otočenom kontajneri počítal súradnice dotyku zle.
 * Vybraný deň preto ukazuje pevný prehľad nad grafom a index dňa
 * počítame sami z polohy prsta na osi X.
 *
 * Body sú denná mriežka za celú dostupnú históriu, zobrazuje sa okno so
 * zvolenou dĺžkou (2/4/8/12 týždňov). Ťahaním po páse osi X sa okno posúva
 * v čase, dvoma prstami sa dá priblížiť. Štatistiky a os Y sa počítajú
 * z toho, čo je vidieť.
 *
 * Dáta pripravuje adaptér (RecoveryTrend, trendy výkonu) – táto karta
 * nevie nič o tom, odkiaľ sú.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer, ComposedChart, Line, Area, Scatter,
  XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot, ReferenceArea,
} from "recharts";
import {
  ChevronLeft, ChevronRight, ChevronsRight, Maximize2, MessageSquareText, X, ZoomOut,
} from "lucide-react";

import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { EventsIcon } from "@/app/shared/charts/RecoveryEvents";

/* ─── typy ─── */

export type TrendSeries = {
  /** kľúč hodnoty v bode */
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

/** pevné pásmo na osi Y (úrovne VO₂max, tuku…) */
export type TrendZone = { from: number; to: number; label: string; color: string };

/**
 * Jeden deň. Hodnoty sérií sú priamo v bode pod `series[].key`
 * (null = v ten deň nič). Ostatné polia sú voliteľné vrstvy.
 */
export type TrendPoint = {
  date: string;
  band?: [number, number] | null;
  base?: number | null;
  missingY?: number | null;
  comments?: string | null;
  hasAlcohol?: boolean;
  hasFood?: boolean;
  hasCaffeine?: boolean;
  eventsY?: number | null;
  noteY?: number | null;
  [key: string]: unknown;
};

export type TrendContext =
  | "baseline" // rozdiel oproti bežnému priemeru (point.base)
  | "band" // pod / v / nad pásmom (point.band + bandTexts)
  | "zones" // v ktorom pevnom pásme je hodnota
  | "change" // zmena oproti prvému meraniu v okne
  | "none";

export type TrendSpec = {
  title: string;
  subtitle: string;
  /** series[0] je hlavná – prehľad a štatistiky */
  series: TrendSeries[];
  /** popis pásma v bodoch (point.band) do legendy */
  bandLabel?: string;
  zones?: TrendZone[];
  context: TrendContext;
  bandTexts?: { below: string; inside: string; above: string };
  /** hodnota s jednotkou do prehľadu */
  fmt: (v: number) => string;
  /** bez jednotky do dlaždíc štatistík (jednotka je v prehľade nad grafom) */
  fmtStat: (v: number) => string;
  /** rozdiel s jednotkou (napr. „+4 ms“) */
  fmtDelta?: (d: number) => string;
  axisFmt: (v: number) => string;
  /** krok osi Y */
  yStep: number;
  /** merania len občas (váha, tuk) – body vždy, výber skočí na meranie */
  sparse?: boolean;
};

const WEEKS = ["2", "4", "8", "12"] as const;
const MARGIN = { top: 10, right: 16, bottom: 4, left: 4 };
/** vnútorný okraj osi X – miesto pre šípky v páse osi */
const X_PAD = 16;
const Y_AXIS_W = 44;
const FULL_Z = 2147483000; // modal (konvencia)
/** najmenší počet dní pri priblížení */
const MIN_SPAN = 7;
/** výška pásu osi X, po ktorom sa dá posúvať v čase */
const AXIS_H = 30;

/* ─── pomocné ─── */

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateSeq(start: Date, days: number): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  for (let i = 0; i < days; i++) {
    out.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Denná mriežka od prvého dňa s dátami (aspoň `minDays` dozadu) po dnešok.
 * `extraLead` pridá dni na začiatok (napr. pre kĺzavý priemer).
 */
export function historyDates(earliestIso: string | null, minDays: number, maxDays = 400, extraLead = 0): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let days = minDays;
  if (earliestIso) {
    const e = new Date(earliestIso.slice(0, 10) + "T00:00:00");
    const span = Math.round((today.getTime() - e.getTime()) / 86400000) + 1;
    days = Math.min(maxDays, Math.max(days, span));
  }
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1) - extraLead);
  return dateSeq(start, days + extraLead);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** šírka/výška okna – na otočenie grafu pri celej obrazovke */
function useViewport() {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const read = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return vp;
}

type View = { from: number; span: number };

function viewRange(v: View, n: number) {
  const from = Math.max(0, Math.min(n - 1, Math.round(v.from)));
  const to = Math.max(from, Math.min(n - 1, Math.round(v.from + v.span) - 1));
  return { from, to };
}

function clampView(v: View, n: number, maxSpan: number): View {
  const span = Math.max(Math.min(MIN_SPAN, n), Math.min(maxSpan, n, v.span));
  const from = Math.max(0, Math.min(n - span, v.from));
  return { from, span };
}

/** kľúč dopočítanej čiary pri riedkych meraniach */
const lineKey = (key: string) => `${key}__line`;

/**
 * Riedke merania (váha, tuk, VO2max): medzi dvoma meraniami čiara lineárne
 * spojí body, po poslednom meraní drží hodnotu až po dnešok – hodnota platí,
 * kým nepríde nové meranie. Jedno meranie = vodorovná čiara. Pred prvým
 * meraním nič. Skutočné merania ostávajú v pôvodnom kľúči (bodky, výber,
 * štatistiky), čiara ide z `<key>__line`.
 */
function fillSparse(points: TrendPoint[], keys: string[]): TrendPoint[] {
  const out = points.map((p) => ({ ...p }));
  for (const key of keys) {
    let prev = -1;
    for (let i = 0; i < out.length; i++) {
      const v = num(out[i][key]);
      if (v == null) continue;
      if (prev >= 0) {
        const a = num(out[prev][key])!;
        for (let j = prev + 1; j < i; j++) out[j][lineKey(key)] = a + ((v - a) * (j - prev)) / (i - prev);
      }
      out[i][lineKey(key)] = v;
      prev = i;
    }
    if (prev >= 0) for (let j = prev + 1; j < out.length; j++) out[j][lineKey(key)] = num(out[prev][key]);
  }
  return out;
}

/** súhrn pre to, čo je práve vidieť (štatistiky, os Y, legenda) */
function windowInfo(points: TrendPoint[], from: number, to: number, spec: TrendSpec) {
  const mainKey = spec.series[0].key;
  const visible = points.slice(from, to + 1);
  const vals = visible.map((p) => num(p[mainKey])).filter((x): x is number => x != null);
  const stats = vals.length
    ? {
        avg: vals.reduce((s, x) => s + x, 0) / vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
        logged: vals.length,
        total: visible.length,
      }
    : { avg: NaN, min: NaN, max: NaN, logged: 0, total: visible.length };

  const domainVals: number[] = [];
  for (const p of visible) {
    for (const s of spec.series) {
      const v = num(p[s.key]) ?? (spec.sparse ? num(p[lineKey(s.key)]) : null);
      if (v != null) domainVals.push(v);
    }
    if (p.band) domainVals.push(p.band[0], p.band[1]);
  }
  const step = spec.yStep;
  let yMin = 0;
  let yMax = step * 4;
  if (domainVals.length) {
    yMin = Math.max(0, Math.floor((Math.min(...domainVals) - step / 2) / step) * step);
    yMax = Math.ceil((Math.max(...domainVals) + step / 2) / step) * step;
  }
  // pevné značky na násobkoch kroku – inak Recharts zvolí „7,6 h“ a pod.
  let tickStep = step;
  while ((yMax - yMin) / tickStep > 6) tickStep *= 2;
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) ticks.push(v);

  // posledná hodnota – pri riedkych meraniach aj pred oknom (aktuálny stav)
  let lastIdx = -1;
  for (let i = to; i >= (spec.sparse ? 0 : from); i--)
    if (num(points[i]?.[mainKey]) != null) {
      lastIdx = i;
      break;
    }
  let firstIdx = -1;
  for (let i = from; i <= to; i++)
    if (num(points[i]?.[mainKey]) != null) {
      firstIdx = i;
      break;
    }

  return {
    visible,
    stats,
    yMin,
    yMax,
    ticks,
    lastIdx,
    firstIdx,
    present: new Set(
      spec.series
        .filter((s) => visible.some((p) => num(p[s.key]) != null || (spec.sparse && num(p[lineKey(s.key)]) != null)))
        .map((s) => s.key),
    ),
    anyBand: visible.some((p) => p.band != null),
    anyMissing: visible.some((p) => p.missingY != null),
    anyEvents: visible.some((p) => p.hasAlcohol || p.hasFood || p.hasCaffeine),
    anyNotes: visible.some((p) => p.noteY != null),
  };
}
type Info = ReturnType<typeof windowInfo>;

/* ─── prehľad vybraného dňa ─── */

function Readout({
  spec,
  points,
  idx,
  info,
  locale,
  isLatest,
  compact,
}: {
  spec: TrendSpec;
  points: TrendPoint[];
  idx: number | null;
  info: Info;
  locale: string;
  isLatest: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const p = idx != null ? points[idx] : null;
  if (!p) {
    return (
      <div className="text-sm" style={{ color: appColors.textMuted }}>
        {t("recovery.trends.common.noData")}
      </div>
    );
  }
  const main = spec.series[0];
  const val = num(p[main.key]);
  const dateLabel = new Date(p.date + "T00:00:00").toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  let context: string | null = null;
  if (val != null) {
    if (spec.context === "baseline" && p.base != null && spec.fmtDelta) {
      context = `${spec.fmtDelta(val - p.base)} ${t("recovery.trends.common.vsNormal")}`;
    } else if (spec.context === "band" && p.band && spec.bandTexts) {
      context = val < p.band[0] ? spec.bandTexts.below : val > p.band[1] ? spec.bandTexts.above : spec.bandTexts.inside;
    } else if (spec.context === "zones" && spec.zones?.length) {
      const z = spec.zones.find((z) => val >= z.from && val < z.to) ?? null;
      if (z) context = z.label;
    } else if (spec.context === "change" && spec.fmtDelta && info.firstIdx >= 0 && idx !== info.firstIdx) {
      const first = num(points[info.firstIdx][main.key]);
      if (first != null) context = `${spec.fmtDelta(val - first)} ${t("recovery.trends.common.inPeriod")}`;
    }
  }

  const others = spec.series
    .slice(1)
    .map((s) => ({ s, v: num(p[s.key]) }))
    .filter((x) => x.v != null);

  const events = [
    p.hasAlcohol && `🍷 ${t("recovery.trends.events.alcohol")}`,
    p.hasFood && `🍔 ${t("recovery.trends.events.food")}`,
    p.hasCaffeine && `☕ ${t("recovery.trends.events.caffeine")}`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
        {isLatest ? `${t(spec.sparse ? "recovery.trends.common.latestMeasurement" : "recovery.trends.common.latest")} · ` : ""}
        {dateLabel}
      </div>
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
        {spec.series.length > 1 ? (
          // viac sérií – povedz, ktorá je tá veľká hodnota
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: appColors.textSecondary }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: main.color }} />
            {main.label}
          </span>
        ) : null}
        {val != null ? (
          <span className={`${compact ? "text-xl" : "text-2xl"} font-bold tabular-nums`} style={{ color: appColors.textPrimary }}>
            {spec.fmt(val)}
          </span>
        ) : (
          <span className="text-base font-semibold" style={{ color: appColors.textMuted }}>
            {t("recovery.trends.common.noRecord")}
          </span>
        )}
        {context ? (
          <span className="text-xs" style={{ color: appColors.textSecondary }}>
            {context}
          </span>
        ) : null}
      </div>
      {others.length ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
          {others.map(({ s, v }) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}: {spec.fmt(v as number)}
            </span>
          ))}
        </div>
      ) : null}
      {events.length ? (
        <div className="mt-1 text-xs" style={{ color: appColors.textMuted }}>
          {events.join(" · ")}
        </div>
      ) : null}
      {p.comments?.trim() ? (
        <div
          className="mt-1.5 flex gap-1.5 text-xs leading-relaxed rounded-lg px-2 py-1.5"
          style={{ color: appColors.textSecondary, background: appColors.surfaceSolid }}
        >
          <MessageSquareText size={13} className="shrink-0 mt-0.5" color={appColors.textMuted} />
          <span className={`italic whitespace-pre-wrap min-w-0 ${compact ? "line-clamp-1" : "line-clamp-3"}`}>
            {p.comments.trim()}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ─── graf ─── */

function NoteMark(props: any) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return <g />;
  // malá bublina nad bodom – deň má poznámku (detail v prehľade po ťuknutí)
  const x = cx - 6;
  const y = cy - 22;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={12} height={9} rx={2.5} fill={appColors.textSecondary} />
      <path d={`M${cx - 2} ${y + 9} L${cx} ${y + 12} L${cx + 1} ${y + 9} Z`} fill={appColors.textSecondary} />
    </g>
  );
}

function ZoneLabel({ viewBox, text, color }: any) {
  if (!viewBox || viewBox.height < 14) return null; // úzky pás – bez textu
  return (
    <text
      x={viewBox.x + viewBox.width - 6}
      y={viewBox.y + viewBox.height / 2}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={10}
      fontWeight={600}
      fill={color}
      opacity={0.8}
    >
      {text}
    </text>
  );
}

function Chart({
  spec,
  points,
  info,
  view,
  setView,
  maxSpan,
  selIdx,
  onSelect,
  rotated,
  dense,
  locale,
}: {
  spec: TrendSpec;
  points: TrendPoint[];
  info: Info;
  view: View;
  setView: (v: View) => void;
  maxSpan: number;
  selIdx: number | null;
  onSelect: (i: number | null) => void;
  rotated: boolean;
  dense: boolean;
  locale: string;
}) {
  const t = useT();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const pointers = useRef(new Map<number, number>());
  const pinch = useRef<{ d0: number; span0: number; anchor: number } | null>(null);
  const pan = useRef<{ pos0: number; from0: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const n = points.length;
  const mainKey = spec.series[0].key;

  const { from, to } = viewRange(view, n);
  const visible = info.visible;
  const m = visible.length;

  /** poloha prsta/myši na osi X grafu (px od začiatku plochy grafu) */
  const geometry = useCallback(
    (clientX: number, clientY: number) => {
      const el = layerRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // pri otočení o 90° beží os X grafu zhora nadol
      const along = rotated ? clientY - r.top : clientX - r.left;
      const length = rotated ? r.height : r.width;
      const left = MARGIN.left + Y_AXIS_W + X_PAD;
      const plotW = length - left - MARGIN.right - X_PAD;
      return plotW > 0 ? { pos: along - left, plotW } : null;
    },
    [rotated],
  );

  const idxAt = (clientX: number, clientY: number) => {
    const g = geometry(clientX, clientY);
    if (!g || m === 0) return null;
    const local = Math.min(m - 1, Math.max(0, Math.floor((g.pos / g.plotW) * m)));
    if (!spec.sparse) return from + local;
    // riedke merania: najbližší deň, kde niečo je
    let best: number | null = null;
    for (let d = 0; d < m; d++) {
      for (const i of [local - d, local + d]) {
        if (i >= 0 && i < m && spec.series.some((s) => num(visible[i][s.key]) != null)) {
          best = i;
          break;
        }
      }
      if (best != null) break;
    }
    return best != null ? from + best : null;
  };

  const apply = useCallback((v: View) => setView(clampView(v, n, maxSpan)), [setView, n, maxSpan]);

  // počítač: Ctrl + koliesko / pinch na touchpade = priblíženie,
  // vodorovné koliesko (touchpad dvoma prstami do strany) = posun v čase
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const g = geometry(e.clientX, e.clientY);
      if (!g) return;
      const v = viewRef.current;
      if (e.ctrlKey) {
        e.preventDefault();
        const frac = Math.max(0, Math.min(1, g.pos / g.plotW));
        const span = v.span * Math.exp(e.deltaY * 0.01);
        apply({ from: v.from + frac * v.span - frac * span, span });
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        apply({ from: v.from + (e.deltaX / g.plotW) * v.span, span: v.span });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [geometry, apply]);

  const pinchValues = () => Array.from(pointers.current.values());
  const endPointer = (id: number) => {
    pointers.current.delete(id);
    if (pointers.current.size < 2) pinch.current = null;
    dragging.current = false;
  };

  const fmtTick = (v: string) =>
    new Date(v + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "numeric" });
  const targetTicks = dense ? 10 : 6;
  const interval = Math.max(0, Math.ceil(m / targetTicks) - 1);
  const sel = selIdx != null && selIdx >= from && selIdx <= to ? points[selIdx] : null;
  const selY = sel ? (num(sel[mainKey]) ?? sel.missingY ?? null) : null;
  // husté body splývajú do „bodkovanej“ čiary – pri veľa meraniach len čiara
  const measured = visible.filter((p) => spec.series.some((s) => num(p[s.key]) != null)).length;
  const showDots = spec.sparse ? measured <= 20 : m <= 31;

  const atEnd = to >= n - 1;
  const atStart = from <= 0;

  return (
    <div className="relative w-full h-full">
      {/* pás osi X – podklad naznačuje, že sa dá ťahať */}
      <div
        className="absolute rounded-lg pointer-events-none flex items-center justify-between px-1"
        style={{
          left: 0,
          right: 0,
          bottom: 0,
          height: AXIS_H,
          background: appColors.surfaceSolid,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          color: appColors.textMuted,
        }}
      >
        <ChevronLeft size={12} style={{ opacity: atStart ? 0.2 : 0.8 }} />
        <ChevronRight size={12} style={{ opacity: atEnd ? 0.2 : 0.8 }} />
      </div>

      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <ComposedChart data={visible} margin={MARGIN}>
          {(spec.zones ?? []).map((z) => (
            <ReferenceArea
              key={z.label}
              y1={Math.max(info.yMin, z.from)}
              y2={Math.min(info.yMax, z.to)}
              ifOverflow="hidden"
              fill={z.color}
              fillOpacity={0.1}
              strokeOpacity={0}
              label={<ZoneLabel text={z.label} color={z.color} />}
            />
          ))}
          <CartesianGrid vertical={false} stroke={appColors.chartGrid} strokeOpacity={0.35} strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            interval={interval}
            padding={{ left: X_PAD, right: X_PAD }}
            height={AXIS_H - MARGIN.bottom}
            tick={{ fill: appColors.textSecondary, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            dy={2}
            tickFormatter={fmtTick}
          />
          <YAxis
            width={Y_AXIS_W}
            domain={[info.yMin, info.yMax]}
            ticks={info.ticks}
            interval={0}
            tick={{ fill: appColors.textMuted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => spec.axisFmt(Number(v))}
          />
          {info.anyBand ? (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill={appColors.chartBandFill}
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls
            />
          ) : null}
          {sel ? <ReferenceLine x={sel.date} stroke={appColors.textMuted} strokeWidth={1} strokeDasharray="3 3" /> : null}
          {/* hlavnú sériu kreslíme posledne – je navrchu */}
          {[...spec.series].reverse().map((s, ri) =>
            info.present.has(s.key) ? (
              <Line
                key={s.key}
                type={spec.sparse ? "linear" : "monotone"}
                dataKey={spec.sparse ? lineKey(s.key) : s.key}
                stroke={s.color}
                strokeWidth={ri === spec.series.length - 1 ? 2.5 : 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={
                  !showDots
                    ? false
                    : spec.sparse
                      ? // bodka len na skutočnom meraní, nie na dopočítanej čiare
                        (props: any) =>
                          num(props.payload?.[s.key]) == null || props.cx == null || props.cy == null ? (
                            <g key={props.index} />
                          ) : (
                            <circle
                              key={props.index}
                              cx={props.cx}
                              cy={props.cy}
                              r={3}
                              fill={s.color}
                              stroke={appColors.surfaceSolid}
                              strokeWidth={2}
                            />
                          )
                      : { r: 3, fill: s.color, stroke: appColors.surfaceSolid, strokeWidth: 2 }
                }
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            ) : null,
          )}
          {info.anyMissing ? (
            // chýbajúce dni: prázdny krúžok na dopočítanej polohe
            <Scatter
              dataKey="missingY"
              isAnimationActive={false}
              shape={(props: any) =>
                props.cx == null || props.cy == null ? <g /> : (
                  <circle cx={props.cx} cy={props.cy} r={4} fill={appColors.surfaceSolid} stroke={appColors.stateBad} strokeWidth={1.5} />
                )
              }
            />
          ) : null}
          {info.anyEvents ? <Scatter dataKey="eventsY" shape={<EventsIcon />} isAnimationActive={false} /> : null}
          {info.anyNotes ? <Scatter dataKey="noteY" shape={<NoteMark />} isAnimationActive={false} /> : null}
          {sel && selY != null ? (
            <ReferenceDot
              x={sel.date}
              y={selY}
              r={6}
              fill={num(sel[mainKey]) != null ? spec.series[0].color : appColors.surfaceSolid}
              stroke={num(sel[mainKey]) != null ? appColors.textPrimary : appColors.stateBad}
              strokeWidth={2}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>

      {/* jedna vrstva pre všetky gestá:
          - pás osi X: ťahanie = posun v čase
          - plocha grafu: ťuknutie/ťahanie = výber dňa, dva prsty = priblíženie
          pan-y nechá v karte stránku scrollovať prstom hore-dole */}
      <div
        ref={layerRef}
        aria-label={t("recovery.trends.common.scrubHint")}
        className="absolute inset-0"
        style={{ touchAction: rotated ? "none" : "pan-y", cursor: "crosshair" }}
        onPointerDown={(e) => {
          const g = geometry(e.clientX, e.clientY);
          if (!g) return;
          const r = layerRef.current!.getBoundingClientRect();
          // vzdialenosť od spodného okraja grafu (pri otočení je „spodok“ vľavo)
          const fromBottom = rotated ? e.clientX - r.left : r.bottom - e.clientY;
          if (fromBottom <= AXIS_H && pointers.current.size === 0) {
            pan.current = { pos0: g.pos, from0: viewRef.current.from };
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            return;
          }
          pointers.current.set(e.pointerId, g.pos);
          if (pointers.current.size === 2) {
            const [a, b] = pinchValues();
            const v = viewRef.current;
            pinch.current = {
              d0: Math.max(10, Math.abs(a - b)),
              span0: v.span,
              anchor: v.from + ((a + b) / 2 / g.plotW) * v.span,
            };
            dragging.current = false;
            return;
          }
          dragging.current = true;
          onSelect(idxAt(e.clientX, e.clientY));
        }}
        onPointerMove={(e) => {
          const g = geometry(e.clientX, e.clientY);
          if (!g) return;
          if (pan.current) {
            // prst doprava = späť do minulosti (obsah ide s prstom)
            const v = viewRef.current;
            const dDays = ((g.pos - pan.current.pos0) / g.plotW) * v.span;
            apply({ from: pan.current.from0 - dDays, span: v.span });
            return;
          }
          if (pointers.current.has(e.pointerId)) {
            pointers.current.set(e.pointerId, g.pos);
            if (pinch.current && pointers.current.size >= 2) {
              const [a, b] = pinchValues();
              const d = Math.max(10, Math.abs(a - b));
              const centerFrac = Math.max(0, Math.min(1, (a + b) / 2 / g.plotW));
              const span = pinch.current.span0 * (pinch.current.d0 / d);
              apply({ from: pinch.current.anchor - centerFrac * span, span });
              return;
            }
          }
          // myš: stačí prejsť; prst: len pri ťahaní
          if (e.pointerType === "mouse" || dragging.current) onSelect(idxAt(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          pan.current = null;
          endPointer(e.pointerId);
        }}
        onPointerCancel={(e) => {
          pan.current = null;
          endPointer(e.pointerId);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !pan.current) {
            dragging.current = false;
            onSelect(null);
          }
        }}
      />
    </div>
  );
}

/** tenký ukazovateľ, kde v histórii je zobrazené okno */
function Position({ view, n, color }: { view: View; n: number; color: string }) {
  if (n <= 0) return null;
  const left = (view.from / n) * 100;
  const width = Math.max(2, (view.span / n) * 100);
  return (
    <div className="h-1 rounded-full relative" style={{ background: appColors.surfaceCardBorder }}>
      <div className="absolute top-0 h-1 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
    </div>
  );
}

function ResetButton({ view, n, maxSpan, onReset }: { view: View; n: number; maxSpan: number; onReset: () => void }) {
  const t = useT();
  const zoomed = view.span < Math.min(maxSpan, n) - 0.5;
  const panned = view.from + view.span < n - 0.5;
  if (!zoomed && !panned) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer shrink-0"
      style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.panelBorder}`, color: appColors.textSecondary }}
    >
      {zoomed ? <ZoomOut size={12} /> : <ChevronsRight size={12} />}
      {t(zoomed ? "recovery.trends.common.zoomReset" : "recovery.trends.common.backToToday")}
    </button>
  );
}

function Legend({ spec, info, compact }: { spec: TrendSpec; info: Info; compact?: boolean }) {
  const t = useT();
  const items: { key: string; label: string; swatch: ReactNode }[] = spec.series
    .filter((s) => info.present.has(s.key))
    .map((s) => ({
      key: s.key,
      label: s.label,
      swatch: s.dashed ? (
        <span className="inline-block w-4 h-0 border-t-2 border-dashed" style={{ borderColor: s.color }} />
      ) : (
        <span className="inline-block w-4 h-[3px] rounded-full" style={{ background: s.color }} />
      ),
    }));
  if (info.anyBand && spec.bandLabel)
    items.push({
      key: "band",
      label: spec.bandLabel,
      swatch: <span className="inline-block w-4 h-3 rounded-sm" style={{ background: appColors.chartBandFill }} />,
    });
  if (info.anyMissing)
    items.push({
      key: "missing",
      label: t("recovery.trends.common.missingLabel"),
      swatch: <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ border: `1.5px solid ${appColors.stateBad}` }} />,
    });

  // jedna séria bez ďalších vrstiev – názov je v nadpise, legenda netreba
  if (items.length <= 1 && !info.anyNotes && !info.anyEvents) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5" style={{ color: appColors.textMuted }}>
          {it.swatch}
          {it.label}
        </span>
      ))}
      {info.anyNotes ? (
        <span className="inline-flex items-center gap-1.5" style={{ color: appColors.textMuted }}>
          <MessageSquareText size={12} />
          {t("recovery.trends.common.note")}
        </span>
      ) : null}
      {info.anyEvents ? (
        <span style={{ color: appColors.textMuted }}>
          🍷 {t("recovery.trends.events.alcohol")} · 🍔 {t("recovery.trends.events.food")} · ☕{" "}
          {t("recovery.trends.events.caffeine")}
        </span>
      ) : null}
    </div>
  );
}

function Stats({ spec, info }: { spec: TrendSpec; info: Info }) {
  const t = useT();
  const s = info.stats;
  const f = spec.fmtStat;
  const cells = [
    { label: t("recovery.trends.common.avg"), value: Number.isFinite(s.avg) ? f(s.avg) : "—" },
    { label: t("recovery.trends.common.min"), value: Number.isFinite(s.min) ? f(s.min) : "—" },
    { label: t("recovery.trends.common.max"), value: Number.isFinite(s.max) ? f(s.max) : "—" },
    spec.sparse
      ? { label: t("recovery.trends.common.measurements"), value: String(s.logged) }
      : { label: t("recovery.trends.common.logged"), value: `${s.logged}/${s.total}` },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-xl px-2 py-2 min-w-0"
          style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
        >
          <div className="text-[10px] uppercase tracking-wide truncate" style={{ color: appColors.textMuted }}>
            {c.label}
          </div>
          <div className="text-sm font-semibold tabular-nums truncate" style={{ color: appColors.textPrimary }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeksControl({ weeks, setWeeks }: { weeks: number; setWeeks: (w: number) => void }) {
  const t = useT();
  return (
    <SegmentedControl
      options={WEEKS.map((w) => ({ value: w, label: `${w} ${t("common.units.weeksAbbrev")}` }))}
      value={String(weeks) as (typeof WEEKS)[number]}
      onChange={(v) => setWeeks(Number(v))}
    />
  );
}

/* ─── celá obrazovka (na šírku) ─── */

type Shared = {
  spec: TrendSpec;
  points: TrendPoint[];
  info: Info;
  view: View;
  setView: (v: View) => void;
  maxSpan: number;
  resetView: () => void;
  weeks: number;
  setWeeks: (w: number) => void;
  selIdx: number | null;
  setSelIdx: (i: number | null) => void;
  locale: string;
  extraControls?: ReactNode;
};

function shownIndex(s: Pick<Shared, "selIdx" | "info">) {
  return s.selIdx ?? (s.info.lastIdx >= 0 ? s.info.lastIdx : null);
}

function Fullscreen({ onClose, ...s }: Shared & { onClose: () => void }) {
  const t = useT();
  const vp = useViewport();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // spodná navigácia by prekážala (id v MobileBottomBar)
    const nav = document.getElementById("mobile-bottom-nav");
    if (nav) nav.style.setProperty("display", "none", "important");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Android/Chrome: skutočná celá obrazovka + zamknutie na šírku.
    // iOS to nepodporuje – tam graf otočíme cez CSS (nižšie).
    const el = rootRef.current as any;
    (async () => {
      try {
        if (el?.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        /* nepodporované – ostáva CSS otočenie */
      }
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      if (nav) nav.style.removeProperty("display");
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      try {
        (screen.orientation as any)?.unlock?.();
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // na výšku (telefón) otočíme obsah o 90°, aby bol graf na šírku
  const rotated = vp.h > vp.w && vp.w > 0 && vp.w < 900;
  const stageW = rotated ? vp.h : vp.w;
  const stageH = rotated ? vp.w : vp.h;
  const n = s.points.length;
  const { to } = viewRange(s.view, n);

  const overlay = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: FULL_Z, background: appColors.backgroundMain, overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: rotated ? vp.w : 0,
          width: stageW,
          height: stageH,
          transform: rotated ? "rotate(90deg)" : "none",
          transformOrigin: "top left",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          // výrez a home indikátor – pri otočení sú po stranách
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          boxSizing: "border-box",
        }}
      >
        <div className="flex items-start gap-3 shrink-0">
          <div className="min-w-0 flex-1 flex items-start gap-4">
            <div className="text-base font-semibold shrink-0 pt-3" style={{ color: appColors.textPrimary }}>
              {s.spec.title}
            </div>
            <Readout
              spec={s.spec}
              points={s.points}
              idx={shownIndex(s)}
              info={s.info}
              locale={s.locale}
              isLatest={s.selIdx == null && to >= n - 1}
              compact
            />
          </div>
          <ResetButton view={s.view} n={n} maxSpan={s.maxSpan} onReset={s.resetView} />
          {s.extraControls ? <div className="w-[220px] shrink-0">{s.extraControls}</div> : null}
          <div className="w-[200px] shrink-0">
            <WeeksControl weeks={s.weeks} setWeeks={s.setWeeks} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("recovery.trends.common.close")}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.panelBorder}`, color: appColors.textPrimary }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 mt-2">
          <Chart
            spec={s.spec}
            points={s.points}
            info={s.info}
            view={s.view}
            setView={s.setView}
            maxSpan={s.maxSpan}
            selIdx={s.selIdx}
            onSelect={s.setSelIdx}
            rotated={rotated}
            dense
            locale={s.locale}
          />
        </div>
        <div className="shrink-0 pt-2 space-y-1.5">
          <Position view={s.view} n={n} color={s.spec.series[0].color} />
          <Legend spec={s.spec} info={s.info} compact />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}

/* ─── karta ─── */

export default function TrendCard({
  spec,
  points: pointsIn,
  defaultWeeks = 2,
  loading = false,
  extraControls,
  emptyText,
}: {
  spec: TrendSpec;
  points: TrendPoint[];
  defaultWeeks?: number;
  loading?: boolean;
  /** ďalší prepínač pod obdobím (napr. vzdialenosť pri odhade časov) */
  extraControls?: ReactNode;
  emptyText?: string;
}) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const points = useMemo(
    () => (spec.sparse ? fillSparse(pointsIn, spec.series.map((s) => s.key)) : pointsIn),
    [pointsIn, spec],
  );
  const [weeks, setWeeks] = useState(defaultWeeks);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const n = points.length;
  const maxSpan = Math.min(weeks * 7, n);

  // okno = zvolené obdobie, na začiatku končí dnešným dňom
  const latestView = useCallback((): View => ({ from: Math.max(0, n - maxSpan), span: maxSpan }), [n, maxSpan]);
  const [view, setView] = useState<View>({ from: 0, span: 1 });
  useEffect(() => {
    setView(latestView());
    setSelIdx(null);
  }, [latestView]);

  const { from, to } = viewRange(view, n);
  const info = useMemo(() => windowInfo(points, from, to, spec), [points, from, to, spec]);
  const hasAny = useMemo(
    () => points.some((p) => spec.series.some((s) => num(p[s.key]) != null)),
    [points, spec],
  );

  if (!mounted) return null;

  const shared: Shared = {
    spec,
    points,
    info,
    view,
    setView,
    maxSpan,
    resetView: () => {
      setView(latestView());
      setSelIdx(null);
    },
    weeks,
    setWeeks,
    selIdx,
    setSelIdx,
    locale,
    extraControls,
  };

  return (
    <>
      {full ? <Fullscreen {...shared} onClose={() => setFull(false)} /> : null}

      <section className={CARD + " relative overflow-hidden"} style={SURFACE_CARD_STYLE}>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                {spec.title}
              </div>
              <div className="text-xs mt-0.5" style={{ color: appColors.textMuted }}>
                {spec.subtitle}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFull(true)}
              disabled={!hasAny}
              aria-label={t("recovery.trends.common.fullscreen")}
              title={t("recovery.trends.common.fullscreen")}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.panelBorder}`, color: appColors.textSecondary }}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <WeeksControl weeks={weeks} setWeeks={setWeeks} />
          {extraControls}

          {!hasAny ? (
            <div className="h-40 grid place-items-center text-sm" style={{ color: appColors.textMuted }}>
              {loading ? <LoadingSpinner size="trend" /> : emptyText ?? t("recovery.trends.common.noData")}
            </div>
          ) : (
            <>
              <div className="min-h-[64px]">
                <Readout
                  spec={spec}
                  points={points}
                  idx={shownIndex(shared)}
                  info={info}
                  locale={locale}
                  isLatest={selIdx == null && to >= n - 1}
                />
              </div>

              <div className="relative" style={{ height: 270 }}>
                <div className="absolute top-0 right-0 z-10">
                  <ResetButton view={view} n={n} maxSpan={maxSpan} onReset={shared.resetView} />
                </div>
                <Chart
                  spec={spec}
                  points={points}
                  info={info}
                  view={view}
                  setView={setView}
                  maxSpan={maxSpan}
                  selIdx={selIdx}
                  onSelect={setSelIdx}
                  rotated={false}
                  dense={false}
                  locale={locale}
                />
              </div>
              <Position view={view} n={n} color={spec.series[0].color} />

              <Legend spec={spec} info={info} />
              <Stats spec={spec} info={info} />
              <p className="text-[11px]" style={{ color: appColors.textMuted }}>
                {t("recovery.trends.common.scrubHint")}
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
