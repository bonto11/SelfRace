"use client";

/*
 * Spoločné kúsky týždenných grafov aktivít (záťaž, monotónnosť, 80/20).
 *
 * Výber týždňa: zvýrazní sa len stĺpec vybraného týždňa, ostatné sa
 * stlmia. PREČO nie tmavé prekrytie pozadia (ako predtým): stmavoval celý
 * graf okolo stĺpca vrátane mriežky a osí a pôsobil ako chyba vykreslenia.
 */

import type { ReactNode } from "react";
import { Rectangle } from "recharts";
import { X } from "lucide-react";

import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import type { Metric } from "@/app/features/activities/types/activities";

export const WEEK_CHOICES = ["2", "4", "8", "12"] as const;
/** priehľadnosť nevybraných stĺpcov pri výbere týždňa */
export const DIM_OPACITY = 0.28;

/** tvar stĺpca, ktorý pri výbere stlmí ostatné týždne */
export function dimShape(selectedIndex: number | null) {
  return (props: any) => (
    <Rectangle
      {...props}
      fillOpacity={selectedIndex == null || props.index === selectedIndex ? 1 : DIM_OPACITY}
    />
  );
}

/** kliknutie na graf → index týždňa (Recharts 3 aj staršie API) */
export function clickedIndex(state: any): number | null {
  if (!state) return null;
  const raw = state.activeTooltipIndex ?? state.activeIndex;
  if (raw === undefined || raw === null) return null;
  const i = Number(raw);
  return Number.isInteger(i) ? i : null;
}

export function fmtMinutes(val: number): string {
  if (!val) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** os pre čas – celé hodiny „5 h“, inak „h:mm“ */
export function fmtMinutesAxis(val: number): string {
  const n = Number(val);
  if (!n) return "0";
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = Math.floor(n % 60);
    return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, "0")}`;
  }
  return `${Math.round(n)} min`;
}

export function WeeksControl({ value, onChange }: { value: number; onChange: (w: number) => void }) {
  const t = useT();
  return (
    <SegmentedControl
      options={WEEK_CHOICES.map((w) => ({ value: w, label: `${w} ${t("common.units.weeksAbbrev")}` }))}
      value={String(value) as (typeof WEEK_CHOICES)[number]}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

export function MetricControl({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  const t = useT();
  return (
    <SegmentedControl
      options={[
        { value: "km", label: t("common.metrics.distance") },
        { value: "time", label: t("common.metrics.time") },
        { value: "trimp", label: t("common.metrics.trimp") },
      ]}
      value={value as "km" | "time" | "trimp"}
      onChange={(v) => onChange(v as Metric)}
    />
  );
}

export function WeeklyCard({
  title,
  tooltip,
  controls,
  readout,
  loading,
  children,
  footer,
}: {
  title: string;
  tooltip?: string;
  controls: ReactNode;
  readout: ReactNode;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  return (
    <section className={CARD + " relative overflow-hidden"} style={SURFACE_CARD_STYLE}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
            {title}
          </h2>
          {tooltip ? <TooltipIcon text={tooltip} /> : null}
        </div>
        {controls}
        <div className="min-h-[72px]">{readout}</div>
        <div
          className="relative select-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none"
        >
          {loading ? (
            <div className="absolute inset-0 grid place-items-center z-10 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
              <LoadingSpinner size="trend" />
            </div>
          ) : null}
          {children}
        </div>
        {footer}
        <p className="text-[11px]" style={{ color: appColors.textMuted }}>
          {t("weeklyCharts.pickHint")}
        </p>
      </div>
    </section>
  );
}

/** prehľad nad grafom – vybraný týždeň alebo súhrn obdobia */
export function Readout({
  heading,
  onClear,
  children,
}: {
  heading: string;
  onClear?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
          {heading}
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
            style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.panelBorder}`, color: appColors.textSecondary }}
          >
            <X size={12} />
            {t("weeklyCharts.clear")}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "bar" | "line" | "dash" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: appColors.textMuted }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "line" ? (
            <span className="inline-block w-4 h-[3px] rounded-full" style={{ background: it.color }} />
          ) : it.kind === "dash" ? (
            <span className="inline-block w-4 h-0 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * popisok osi X – vybraný týždeň zvýraznený.
 * Porovnáva sa text popisku, nie index: pri `interval` > 0 je index
 * poradie zobrazeného popisku, nie týždňa.
 */
export function xTick(selectedLabel: string | null) {
  return (props: any) => {
    const { x, y, payload } = props;
    const sel = selectedLabel != null && payload?.value === selectedLabel;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill={sel ? appColors.brandPrimary : appColors.textMuted}
          fontWeight={sel ? 700 : 400}
          fontSize={10}
        >
          {payload.value}
        </text>
      </g>
    );
  };
}
