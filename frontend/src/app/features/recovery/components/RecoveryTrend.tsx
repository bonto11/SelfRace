"use client";

/*
 * Spoločný trend regenerácie (HRV, RHR, dĺžka a začiatok spánku).
 *
 * PREČO vlastné ťukanie/ťahanie namiesto Recharts Tooltipu:
 *  - plávajúca bublina na telefóne zakrývala graf a prst,
 *  - na celej obrazovke sa graf otáča o 90° (CSS rotate) a Recharts by
 *    v otočenom kontajneri počítal súradnice dotyku zle.
 * Vybraný deň preto ukazuje pevný prehľad nad grafom a index dňa
 * počítame sami z polohy prsta na osi X.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer, ComposedChart, Line, Area, Scatter,
  XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot,
} from "recharts";
import { Maximize2, MessageSquareText, X, ZoomOut } from "lucide-react";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import type { RecoveryRow } from "@/app/features/recovery/types/recovery";
import { rollingMean } from "@/app/shared/utils/recovery";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { EventsIcon } from "@/app/shared/charts/RecoveryEvents";

/* ─── typy ─── */

export type TrendBand =
  | { kind: "rolling"; pct: number } // bežný priemer (14 dní) ± pct
  | { kind: "fixed"; lo: number; hi: number }; // odporúčané pásmo

export type TrendSpec = {
  title: string;
  subtitle: string;
  mainLabel: string;
  /** druhá séria (HRV max) – len keď je zapnuté „Zobraziť detaily“ */
  altLabel?: string;
  value: (r: RecoveryRow) => number; // NaN = chýba
  altValue?: (r: RecoveryRow) => number;
  band: TrendBand;
  bandLabel: string;
  /** hodnota s jednotkou do prehľadu */
  fmt: (v: number) => string;
  /** rozdiel oproti normálu (napr. „+4 ms“) */
  fmtDelta: (d: number) => string;
  /** popis osi Y */
  axisFmt: (v: number) => string;
  /** zaokrúhlenie rozsahu osi Y (krok) */
  yStep: number;
  /** kratší zápis do dlaždíc štatistík (default = fmt) */
  fmtShort?: (v: number) => string;
  /** pri fixnom pásme: texty pod / v / nad pásmom */
  bandTexts?: { below: string; inside: string; above: string };
};

type Point = {
  date: string;
  val: number | null;
  alt: number | null;
  band: [number, number] | null;
  base: number | null;
  missingY: number | null;
  comments?: string | null;
  hasAlcohol: boolean;
  hasFood: boolean;
  hasCaffeine: boolean;
  eventsY: number | null;
  noteY: number | null;
};

const WEEKS = ["2", "4", "8", "12"] as const;
const MARGIN = { top: 10, right: 12, bottom: 4, left: 4 };
const Y_AXIS_W = 40;
const BASELINE_DAYS = 14;
const FULL_Z = 2147483000; // modal (konvencia)

/* ─── pomocné ─── */

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateSeq(start: Date, days: number): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  for (let i = 0; i < days; i++) {
    out.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function interpolateMissing(vals: number[]): (number | null)[] {
  const n = vals.length;
  const out = new Array<number | null>(n).fill(null);
  const nxt = new Array<number>(n).fill(-1);
  let last = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (Number.isFinite(vals[i])) last = i;
    nxt[i] = last;
  }
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(vals[i])) {
      prev = i;
      continue;
    }
    const nx = nxt[i];
    if (prev !== -1 && nx !== -1) out[i] = vals[prev] + (vals[nx] - vals[prev]) * ((i - prev) / (nx - prev));
    else if (prev !== -1) out[i] = vals[prev];
    else if (nx !== -1) out[i] = vals[nx];
  }
  return out;
}

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

/* ─── dáta ─── */

function useTrendData(spec: TrendSpec, weeks: number, showAlt: boolean) {
  const { rows } = useRecoveryData();

  return useMemo(() => {
    const byDate = new Map<string, RecoveryRow>();
    for (const r of rows) byDate.set(r.date, r);

    const days = weeks * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // bežný priemer potrebuje históriu aj pred začiatkom obdobia –
    // inak by prvé dni grafu mali priemer len z 1–2 hodnôt
    const lead = spec.band.kind === "rolling" ? BASELINE_DAYS : 0;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1) - lead);
    const allDates = dateSeq(start, days + lead);

    const allVals = allDates.map((d) => {
      const r = byDate.get(d);
      return r ? spec.value(r) : NaN;
    });
    const baseAll =
      spec.band.kind === "rolling"
        ? rollingMean(allVals.map((v) => (Number.isFinite(v) ? v : null)), BASELINE_DAYS)
        : allDates.map(() => null);

    const dates = allDates.slice(lead);
    const vals = allVals.slice(lead);
    const base = baseAll.slice(lead);
    const missing = interpolateMissing(vals);

    const points: Point[] = dates.map((d, i) => {
      const r = byDate.get(d);
      const v = vals[i];
      const miss = !Number.isFinite(v);
      const a = showAlt && r && spec.altValue ? spec.altValue(r) : NaN;
      let band: [number, number] | null = null;
      if (spec.band.kind === "fixed") band = [spec.band.lo, spec.band.hi];
      else if (base[i] != null) {
        const b = base[i] as number;
        band = [b * (1 - spec.band.pct), b * (1 + spec.band.pct)];
      }
      const hasAlcohol = !!r?.alcohol_consumed;
      const hasFood = !!r?.food_2h_before;
      const hasCaffeine = !!r?.caffeine_8h;
      return {
        date: d,
        val: miss ? null : v,
        alt: Number.isFinite(a) ? a : null,
        band,
        base: base[i] ?? null,
        missingY: miss ? missing[i] : null,
        comments: r?.comments,
        hasAlcohol,
        hasFood,
        hasCaffeine,
        eventsY: hasAlcohol || hasFood || hasCaffeine ? (miss ? missing[i] : v) : null,
        noteY: r?.comments?.trim() ? (miss ? missing[i] : v) : null,
      };
    });

    const valid = vals.filter(Number.isFinite);
    const stats = valid.length
      ? {
          avg: valid.reduce((s, x) => s + x, 0) / valid.length,
          min: Math.min(...valid),
          max: Math.max(...valid),
          logged: valid.length,
          total: vals.length,
        }
      : { avg: NaN, min: NaN, max: NaN, logged: 0, total: vals.length };

    const domainVals = [
      ...valid,
      ...points.map((p) => p.alt).filter((x): x is number => x != null),
      ...points.flatMap((p) => (p.band ? p.band : [])),
    ];
    const step = spec.yStep;
    const yMin = domainVals.length ? Math.floor((Math.min(...domainVals) - step / 2) / step) * step : 0;
    const yMax = domainVals.length ? Math.ceil((Math.max(...domainVals) + step / 2) / step) * step : step * 4;

    // pevné značky na násobkoch kroku – inak Recharts zvolí „7,6 h“ a pod.
    let tickStep = step;
    while ((yMax - Math.max(0, yMin)) / tickStep > 6) tickStep *= 2;
    const ticks: number[] = [];
    for (let v = Math.ceil(Math.max(0, yMin) / tickStep) * tickStep; v <= yMax; v += tickStep) ticks.push(v);

    let lastIdx = -1;
    for (let i = points.length - 1; i >= 0; i--)
      if (points[i].val != null) {
        lastIdx = i;
        break;
      }

    const anyEvents = points.some((p) => p.hasAlcohol || p.hasFood || p.hasCaffeine);
    const anyNotes = points.some((p) => p.noteY != null);
    return { points, stats, yMin: Math.max(0, yMin), yMax, ticks, lastIdx, anyEvents, anyNotes };
  }, [rows, spec, weeks, showAlt]);
}

/* ─── prehľad vybraného dňa ─── */

function Readout({
  spec,
  p,
  locale,
  isLatest,
  compact,
}: {
  spec: TrendSpec;
  p: Point | null;
  locale: string;
  isLatest: boolean;
  compact?: boolean;
}) {
  const t = useT();
  if (!p) return null;
  const dateLabel = new Date(p.date + "T00:00:00").toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  let context: string | null = null;
  if (p.val != null && p.band) {
    if (spec.band.kind === "rolling" && p.base != null) {
      const d = p.val - p.base;
      context = `${spec.fmtDelta(d)} ${t("recovery.trends.common.vsNormal")}`;
    } else if (spec.bandTexts) {
      context =
        p.val < p.band[0] ? spec.bandTexts.below : p.val > p.band[1] ? spec.bandTexts.above : spec.bandTexts.inside;
    }
  }

  const events = [
    p.hasAlcohol && `🍷 ${t("recovery.trends.events.alcohol")}`,
    p.hasFood && `🍔 ${t("recovery.trends.events.food")}`,
    p.hasCaffeine && `☕ ${t("recovery.trends.events.caffeine")}`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
        {isLatest ? t("recovery.trends.common.latest") : dateLabel}
        {isLatest ? ` · ${dateLabel}` : ""}
      </div>
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
        {p.val != null ? (
          <span
            className={`${compact ? "text-xl" : "text-2xl"} font-bold tabular-nums`}
            style={{ color: appColors.textPrimary }}
          >
            {spec.fmt(p.val)}
          </span>
        ) : (
          <span className="text-base font-semibold" style={{ color: appColors.textMuted }}>
            {t("recovery.trends.common.noRecord")}
          </span>
        )}
        {p.alt != null && spec.altLabel ? (
          <span className="text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
            {spec.altLabel}: {spec.fmt(p.alt)}
          </span>
        ) : null}
        {context ? (
          <span className="text-xs" style={{ color: appColors.textSecondary }}>
            {context}
          </span>
        ) : null}
      </div>
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

/** najmenší počet dní pri priblížení */
const MIN_SPAN = 7;

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

function Chart({
  spec,
  data,
  selIdx,
  onSelect,
  rotated,
  dense,
  locale,
}: {
  spec: TrendSpec;
  data: ReturnType<typeof useTrendData>;
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
  const n = data.points.length;

  // priblíženie: zobrazené okno [from, from + span) v indexoch dní
  const [view, setView] = useState({ from: 0, span: n });
  useEffect(() => setView({ from: 0, span: n }), [n]);
  const viewRef = useRef(view);
  viewRef.current = view;

  const minSpan = Math.min(MIN_SPAN, n);
  const from = Math.max(0, Math.min(n - 1, Math.round(view.from)));
  const to = Math.max(from, Math.min(n - 1, Math.round(view.from + view.span) - 1));
  const visible = useMemo(() => data.points.slice(from, to + 1), [data.points, from, to]);
  const m = visible.length;
  const zoomed = view.span < n - 0.5;

  /** poloha prsta/myši na osi X grafu (px od ľavého okraja plochy grafu) */
  const geometry = useCallback(
    (clientX: number, clientY: number) => {
      const el = layerRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // pri otočení o 90° beží os X grafu zhora nadol
      const along = rotated ? clientY - r.top : clientX - r.left;
      const length = rotated ? r.height : r.width;
      const left = MARGIN.left + Y_AXIS_W;
      const plotW = length - left - MARGIN.right;
      return plotW > 0 ? { pos: along - left, plotW } : null;
    },
    [rotated],
  );

  const idxAt = (clientX: number, clientY: number) => {
    const g = geometry(clientX, clientY);
    if (!g || m === 0) return null;
    const local = Math.min(m - 1, Math.max(0, Math.floor((g.pos / g.plotW) * m)));
    return from + local;
  };

  const zoomAround = useCallback(
    (anchor: number, centerFrac: number, span: number) => {
      const sp = Math.max(minSpan, Math.min(n, span));
      const f = Math.max(0, Math.min(n - sp, anchor - centerFrac * sp));
      setView({ from: f, span: sp });
    },
    [minSpan, n],
  );

  // počítač: Ctrl + koliesko / pinch na touchpade (prehliadač ho posiela ako ctrl+wheel)
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const g = geometry(e.clientX, e.clientY);
      if (!g) return;
      const v = viewRef.current;
      const frac = Math.max(0, Math.min(1, g.pos / g.plotW));
      zoomAround(v.from + frac * v.span, frac, v.span * Math.exp(e.deltaY * 0.01));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [geometry, zoomAround]);

  const pinchValues = () => Array.from(pointers.current.values());

  const fmtTick = (v: string) =>
    new Date(v + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "numeric" });
  const targetTicks = dense ? 10 : 6;
  const interval = Math.max(0, Math.ceil(m / targetTicks) - 1);
  const sel = selIdx != null && selIdx >= from && selIdx <= to ? data.points[selIdx] : null;
  const selY = sel ? (sel.val ?? sel.missingY) : null;

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <ComposedChart data={visible} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={appColors.chartGrid} strokeOpacity={0.35} strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            interval={interval}
            tick={{ fill: appColors.textMuted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            dy={6}
            tickFormatter={fmtTick}
          />
          <YAxis
            width={Y_AXIS_W}
            domain={[data.yMin, data.yMax]}
            ticks={data.ticks}
            interval={0}
            tick={{ fill: appColors.textMuted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => spec.axisFmt(Number(v))}
          />
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill={appColors.chartBandFill}
            fillOpacity={1}
            isAnimationActive={false}
            connectNulls
          />
          {sel ? (
            <ReferenceLine x={sel.date} stroke={appColors.textMuted} strokeWidth={1} strokeDasharray="3 3" />
          ) : null}
          {visible.some((p) => p.alt != null) ? (
            <Line
              type="monotone"
              dataKey="alt"
              stroke={appColors.chartRecoveryAlt}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="val"
            stroke={appColors.chartRecoveryMain}
            strokeWidth={2.5}
            dot={m <= 31 ? { r: 3, fill: appColors.chartRecoveryMain, stroke: appColors.surfaceSolid, strokeWidth: 2 } : false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls
          />
          {/* chýbajúce dni: prázdny krúžok na dopočítanej polohe */}
          <Scatter
            dataKey="missingY"
            isAnimationActive={false}
            shape={(props: any) =>
              props.cx == null || props.cy == null ? <g /> : (
                <circle cx={props.cx} cy={props.cy} r={4} fill={appColors.surfaceSolid} stroke={appColors.stateBad} strokeWidth={1.5} />
              )
            }
          />
          <Scatter dataKey="eventsY" shape={<EventsIcon />} isAnimationActive={false} />
          <Scatter dataKey="noteY" shape={<NoteMark />} isAnimationActive={false} />
          {sel && selY != null ? (
            <ReferenceDot
              x={sel.date}
              y={selY}
              r={6}
              fill={sel.val != null ? appColors.chartRecoveryMain : appColors.surfaceSolid}
              stroke={sel.val != null ? appColors.textPrimary : appColors.stateBad}
              strokeWidth={2}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>

      {/* vrstva na ťukanie/ťahanie a priblíženie dvoma prstami.
          pan-y nechá stránku scrollovať prstom hore-dole (karta), na celej
          obrazovke gestá patria len grafu. */}
      <div
        ref={layerRef}
        aria-label={t("recovery.trends.common.scrubHint")}
        className="absolute inset-0"
        style={{ touchAction: rotated ? "none" : "pan-y", cursor: "crosshair" }}
        onPointerDown={(e) => {
          const g = geometry(e.clientX, e.clientY);
          if (g) pointers.current.set(e.pointerId, g.pos);
          if (pointers.current.size === 2) {
            const [a, b] = pinchValues();
            const v = viewRef.current;
            const center = (a + b) / 2;
            pinch.current = {
              d0: Math.max(10, Math.abs(a - b)),
              span0: v.span,
              anchor: v.from + (center / (g?.plotW || 1)) * v.span,
            };
            dragging.current = false;
            return;
          }
          dragging.current = true;
          onSelect(idxAt(e.clientX, e.clientY));
        }}
        onPointerMove={(e) => {
          if (pointers.current.has(e.pointerId)) {
            const g = geometry(e.clientX, e.clientY);
            if (g) pointers.current.set(e.pointerId, g.pos);
            if (pinch.current && pointers.current.size >= 2 && g) {
              const [a, b] = pinchValues();
              const d = Math.max(10, Math.abs(a - b));
              const centerFrac = Math.max(0, Math.min(1, (a + b) / 2 / g.plotW));
              zoomAround(pinch.current.anchor, centerFrac, pinch.current.span0 * (pinch.current.d0 / d));
              return;
            }
          }
          // myš: stačí prejsť; prst: len pri ťahaní
          if (e.pointerType === "mouse" || dragging.current) onSelect(idxAt(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          dragging.current = false;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          dragging.current = false;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") {
            dragging.current = false;
            onSelect(null);
          }
        }}
      />

      {zoomed ? (
        <button
          type="button"
          onClick={() => setView({ from: 0, span: n })}
          className="absolute top-0 right-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
          style={{
            background: appColors.surfaceSolid,
            border: `1px solid ${appColors.panelBorder}`,
            color: appColors.textSecondary,
          }}
        >
          <ZoomOut size={12} />
          {t("recovery.trends.common.zoomReset")}
        </button>
      ) : null}
    </div>
  );
}

function Legend({ spec, data, compact }: { spec: TrendSpec; data: ReturnType<typeof useTrendData>; compact?: boolean }) {
  const t = useT();
  const items: { key: string; label: string; swatch: ReactNode }[] = [
    {
      key: "main",
      label: spec.mainLabel,
      swatch: <span className="inline-block w-4 h-[3px] rounded-full" style={{ background: appColors.chartRecoveryMain }} />,
    },
  ];
  if (data.points.some((p) => p.alt != null) && spec.altLabel)
    items.push({
      key: "alt",
      label: spec.altLabel,
      swatch: (
        <span
          className="inline-block w-4 h-0 border-t-2 border-dashed"
          style={{ borderColor: appColors.chartRecoveryAlt }}
        />
      ),
    });
  items.push({
    key: "band",
    label: spec.bandLabel,
    swatch: <span className="inline-block w-4 h-3 rounded-sm" style={{ background: appColors.chartBandFill }} />,
  });
  if (data.points.some((p) => p.missingY != null))
    items.push({
      key: "missing",
      label: t("recovery.trends.common.missingLabel"),
      swatch: (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ border: `1.5px solid ${appColors.stateBad}` }}
        />
      ),
    });

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {items.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5" style={{ color: appColors.textMuted }}>
          {it.swatch}
          {it.label}
        </span>
      ))}
      {data.anyNotes ? (
        <span className="inline-flex items-center gap-1.5" style={{ color: appColors.textMuted }}>
          <MessageSquareText size={12} />
          {t("recovery.trends.common.note")}
        </span>
      ) : null}
      {data.anyEvents ? (
        <span style={{ color: appColors.textMuted }}>
          🍷 {t("recovery.trends.events.alcohol")} · 🍔 {t("recovery.trends.events.food")} · ☕{" "}
          {t("recovery.trends.events.caffeine")}
        </span>
      ) : null}
    </div>
  );
}

function Stats({ spec, data }: { spec: TrendSpec; data: ReturnType<typeof useTrendData> }) {
  const t = useT();
  const s = data.stats;
  const f = spec.fmtShort ?? spec.fmt;
  const cells = [
    { label: t("recovery.trends.common.avg"), value: Number.isFinite(s.avg) ? f(s.avg) : "—" },
    { label: t("recovery.trends.common.min"), value: Number.isFinite(s.min) ? f(s.min) : "—" },
    { label: t("recovery.trends.common.max"), value: Number.isFinite(s.max) ? f(s.max) : "—" },
    { label: t("recovery.trends.common.logged"), value: `${s.logged}/${s.total}` },
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

/* ─── celá obrazovka (na šírku) ─── */

function Fullscreen({
  spec,
  weeks,
  setWeeks,
  showAlt,
  locale,
  onClose,
}: {
  spec: TrendSpec;
  weeks: number;
  setWeeks: (w: number) => void;
  showAlt: boolean;
  locale: string;
  onClose: () => void;
}) {
  const t = useT();
  const vp = useViewport();
  const data = useTrendData(spec, weeks, showAlt);
  const [selIdx, setSelIdx] = useState<number | null>(null);
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

  const shownIdx = selIdx ?? (data.lastIdx >= 0 ? data.lastIdx : null);
  const shown = shownIdx != null ? data.points[shownIdx] : null;

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
              {spec.title}
            </div>
            <Readout spec={spec} p={shown} locale={locale} isLatest={selIdx == null} compact />
          </div>
          <div className="w-[200px] shrink-0">
            <SegmentedControl
              options={WEEKS.map((w) => ({ value: w, label: `${w} ${t("common.units.weeksAbbrev")}` }))}
              value={String(weeks) as (typeof WEEKS)[number]}
              onChange={(v) => setWeeks(Number(v))}
            />
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
          <Chart spec={spec} data={data} selIdx={selIdx} onSelect={setSelIdx} rotated={rotated} dense locale={locale} />
        </div>
        <div className="shrink-0 pt-1">
          <Legend spec={spec} data={data} compact />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}

/* ─── karta ─── */

export default function RecoveryTrend({ spec, showAlt = false }: { spec: TrendSpec; showAlt?: boolean }) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const [weeks, setWeeks] = useState(2);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useTrendData(spec, weeks, showAlt);
  useEffect(() => setSelIdx(null), [weeks]);

  if (!mounted) return null;

  const shownIdx = selIdx ?? (data.lastIdx >= 0 ? data.lastIdx : null);
  const shown = shownIdx != null ? data.points[shownIdx] : null;

  return (
    <>
      {full ? (
        <Fullscreen
          spec={spec}
          weeks={weeks}
          setWeeks={setWeeks}
          showAlt={showAlt}
          locale={locale}
          onClose={() => setFull(false)}
        />
      ) : null}

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
              aria-label={t("recovery.trends.common.fullscreen")}
              title={t("recovery.trends.common.fullscreen")}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.panelBorder}`, color: appColors.textSecondary }}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <SegmentedControl
            options={WEEKS.map((w) => ({ value: w, label: `${w} ${t("common.units.weeksAbbrev")}` }))}
            value={String(weeks) as (typeof WEEKS)[number]}
            onChange={(v) => setWeeks(Number(v))}
          />

          <div className="min-h-[64px]">
            <Readout spec={spec} p={shown} locale={locale} isLatest={selIdx == null} />
          </div>

          <div style={{ height: 260 }}>
            <Chart spec={spec} data={data} selIdx={selIdx} onSelect={setSelIdx} rotated={false} dense={false} locale={locale} />
          </div>

          <Legend spec={spec} data={data} />
          <Stats spec={spec} data={data} />
          <p className="text-[11px]" style={{ color: appColors.textMuted }}>
            {t("recovery.trends.common.scrubHint")}
          </p>
        </div>
      </section>
    </>
  );
}
