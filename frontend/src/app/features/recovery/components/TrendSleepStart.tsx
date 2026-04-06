"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import { wrapToLines } from "@/app/shared/utils/recovery";
import { minutesToHHMM, HHMMToMinutes } from "@/app/shared/utils/time";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function getLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(getLocalISODate(d));
  }
  return out;
}

const DAY_MIN = 24 * 60;

function minutesToClockLabel(v: number, t: (key: any) => string): string {
  if (!Number.isFinite(v)) return "—";
  const m = ((Math.round(v) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return minutesToHHMM(m,t);
}

function parseHHMMToDayMinutesSafe(hhmm: string): number {
  const raw = HHMMToMinutes(hhmm);
  if (raw === null || !Number.isFinite(raw)) return NaN;
  return ((raw % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

function shiftAfterMidnightForChart(dayMin: number): number {
  if (!Number.isFinite(dayMin)) return NaN;
  const cutoff = 12 * 60; 
  return dayMin < cutoff ? dayMin + DAY_MIN : dayMin;
}

const SleepStartTooltip = ({ active, payload, label, t }: any) => {
  if (active && payload && payload.length) {
    const mainData = payload.find((p: any) => p.dataKey === "val");
    const missingData = payload.find((p: any) => p.dataKey === "missingY");
    const comments = payload[0].payload.comments;

    return (
      <div
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md max-w-xs"
        style={{
          backgroundColor: "rgba(9, 24, 18, 0.92)",
          borderColor: appColors.panelBorder,
        }}
      >
        <p
          className="mb-2 text-xs font-semibold"
          style={{ color: appColors.textMuted }}
        >
          {new Date(label).toLocaleDateString("sk-SK")}
        </p>

        {mainData && mainData.value != null ? (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: mainData.color }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: mainData.color }}
            ></span>
            <span className="opacity-90">
              {t("recovery.trends.sleepStart.tooltipLabel")}:
            </span>
            <span className="font-bold">
              {minutesToClockLabel(mainData.value,t)}
            </span>
          </div>
        ) : missingData ? (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span className="opacity-90">
              {t("recovery.trends.common.noRecord")}
            </span>
          </div>
        ) : null}

        {comments && (
          <div
            className="mt-2 pt-2 border-t text-[11px] opacity-70 italic whitespace-pre-wrap"
            style={{ borderColor: appColors.divider }}
          >
            {wrapToLines(comments, 44).join("\n")}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function TrendSleepStart() {
  const t = useT();
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const COLOR = {
    main: appColors.chartLine1,
    bandFill: appColors.chartBandFill,
    missing: appColors.stateBad,
  };

  useEffect(() => {
    setLoading(true);
    const tt = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(tt);
  }, [weeks, all]);

  const days = weeks * 7;
  const endISO = useMemo(() => isMounted ? getLocalISODate(new Date()) : getLocalISODate(new Date()), [isMounted]);
  
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setDate(d.getDate() - (days - 1));
    return getLocalISODate(d);
  }, [endISO, days]);

  const byDate = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const r of all) m.set(r.date, r);
    return m;
  }, [all]);

  const labelsISO = useMemo(
    () => dateSeq(startISO, endISO),
    [startISO, endISO],
  );

  const startMin = useMemo(
    () =>
      labelsISO.map((d) => {
        const rec = byDate.get(d);
        if (!rec?.sleep_start_time) return NaN;
        const dayMin = parseHHMMToDayMinutesSafe(rec.sleep_start_time);
        const chartMin = shiftAfterMidnightForChart(dayMin);
        return Number.isFinite(chartMin) ? chartMin : NaN;
      }),
    [labelsISO, byDate],
  );

  const missingY = useMemo(() => {
    const n = startMin.length;
    const out = new Array<number | null>(n).fill(null);
    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(startMin[i])) last = i;
      nextKnown[i] = last;
    }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(startMin[i])) {
        prev = i;
        continue;
      }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = startMin[prev] as number;
        const vn = startMin[nxt] as number;
        y = vp + (vn - vp) * ((i - prev) / (nxt - prev));
      } else if (prev !== -1) y = startMin[prev] as number;
      else if (nxt !== -1) y = startMin[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [startMin]);

  const chartData = useMemo(() => {
    return labelsISO.map((d, i) => {
      const v = startMin[i];
      const isMissing = !Number.isFinite(v);
      return {
        date: d,
        val: isMissing ? null : v,
        bandRange: [22 * 60, 23 * 60], 
        missingY: isMissing ? missingY[i] : null,
        comments: byDate.get(d)?.comments,
      };
    });
  }, [labelsISO, startMin, missingY, byDate]);

  if (!isMounted) return null;

  const allY = [...startMin.filter(Number.isFinite), 22 * 60, 23 * 60];
  const minY = Math.floor(Math.min(...allY) / 60) * 60 - 60; 
  const maxY = Math.ceil(Math.max(...allY) / 60) * 60 + 60; 

  return (
    <section className={CARD + " relative"} style={SURFACE_CARD_STYLE}>
      <div
        className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET} flex-wrap gap-4`}
      >
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            {t("recovery.trends.sleepStart.title")}
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            {t("recovery.trends.sleepStart.subtitle")}
          </div>
        </div>

        <div className="ml-auto">
          <SelectField
            value={String(weeks)}
            onChange={(e) => setWeeks(Number(e.target.value))}
            options={WEEK_OPTIONS(t)}
            variant="editable"
            containerClassName="w-[120px]"
          />
        </div>
      </div>

      <div className={CARD_BODY_INSET}>
        <div className="w-full relative" style={{ height: 320 }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={appColors.chartGrid}
              />

              <XAxis
                dataKey="date"
                tick={{ fill: appColors.textMuted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                dy={10}
                tickFormatter={(val) =>
                  new Date(val).toLocaleDateString("sk-SK", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                }
              />

              <YAxis
                domain={[minY, maxY]}
                tick={{ fill: appColors.textMuted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => minutesToClockLabel(Number(val),t)} 
                label={{ value: `${t("common.units.hour")}`, angle: -90, position: 'insideLeft', fill: appColors.textMuted, fontSize: 10, dy: 30 }}
              />

              <Tooltip
                content={<SleepStartTooltip t={t} />}
                cursor={{
                  stroke: appColors.textMuted,
                  strokeWidth: 1,
                  strokeDasharray: "5 5",
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
              />

              <Area
                type="monotone"
                dataKey="bandRange"
                stroke="none"
                fill={COLOR.bandFill}
                fillOpacity={1}
                legendType="none"
                connectNulls
              />

              <Line
                type="monotone"
                dataKey="val"
                name={t("recovery.trends.sleepStart.label") as string}
                stroke={COLOR.main}
                strokeWidth={3}
                dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
              <Scatter
                dataKey="missingY"
                name={t("recovery.trends.common.missingLabel") as string}
                fill={COLOR.missing}
                r={4}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}