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
import { minutesToHHMM } from "@/app/shared/utils/time";
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

import { EventsIcon, TooltipEvents, EventsLegend } from "@/app/shared/charts/RecoveryEvents";

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

function sanitizeSleepDurationMin(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return NaN;
  if (v < 0) return NaN;
  if (v > 18 * 60) return NaN;
  return v;
}

const SleepDurationTooltip = ({ active, payload, label, t }: any) => {
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
              {t("recovery.trends.sleepDuration.tooltipLabel")}:
            </span>
            <span className="font-bold">{minutesToHHMM(mainData.value,t)}</span>
          </div>
        ) : missingData ? (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span className="opacity-90">
              {t("recovery.trends.common.noRecord")}
            </span>
          </div>
        ) : null}

        <TooltipEvents payload={payload[0].payload} t={t} />

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

export default function TrendSleepDuration() {
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

  const sleepMin = useMemo(
    () =>
      labelsISO.map((d) =>
        sanitizeSleepDurationMin(byDate.get(d)?.sleep_duration_min),
      ),
    [labelsISO, byDate],
  );

  const missingY = useMemo(() => {
    const n = sleepMin.length;
    const out = new Array<number | null>(n).fill(null);
    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(sleepMin[i])) last = i;
      nextKnown[i] = last;
    }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(sleepMin[i])) {
        prev = i;
        continue;
      }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = sleepMin[prev] as number;
        const vn = sleepMin[nxt] as number;
        y = vp + (vn - vp) * ((i - prev) / (nxt - prev));
      } else if (prev !== -1) y = sleepMin[prev] as number;
      else if (nxt !== -1) y = sleepMin[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [sleepMin]);

  const chartData = useMemo(() => {
    return labelsISO.map((d, i) => {
      const v = sleepMin[i];
      const isMissing = !Number.isFinite(v);
      
      const rec = byDate.get(d);
      const hasAlcohol = !!rec?.alcohol_consumed;
      const hasFood = !!rec?.food_2h_before;
      const hasCaffeine = !!rec?.caffeine_8h;
      const hasAnyEvent = hasAlcohol || hasFood || hasCaffeine;
      const eventsYPos = isMissing ? missingY[i] : v;

      return {
        date: d,
        val: isMissing ? null : v,
        bandRange: [420, 540], 
        missingY: isMissing ? missingY[i] : null,
        comments: rec?.comments,
        hasAlcohol,
        hasFood,
        hasCaffeine,
        eventsY: hasAnyEvent ? eventsYPos : null,
      };
    });
  }, [labelsISO, sleepMin, missingY, byDate]);

  if (!isMounted) return null;

  const validValues = sleepMin.filter(Number.isFinite);
  const minValue = validValues.length ? Math.min(...validValues) : 360; 
  const maxValue = validValues.length ? Math.max(...validValues) : 600; 
  const yMin = Math.max(0, Math.floor((minValue - 60) / 60) * 60);
  const yMax = Math.ceil((maxValue + 60) / 60) * 60;

  return (
    <section className={CARD + " relative pb-2"} style={SURFACE_CARD_STYLE}>
      <div
        className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET} flex-wrap gap-4`}
      >
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            {t("recovery.trends.sleepDuration.title")}
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            {t("recovery.trends.sleepDuration.subtitle")}
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
              margin={{ top: 10, right: 10, left: 10, bottom: 35 }}
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
                domain={[yMin, yMax]}
                tick={{ fill: appColors.textMuted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${Math.floor(Number(val) / 60)}`}
                label={{ value: `${t("common.units.hour")}`, angle: -90, position: 'insideLeft', fill: appColors.textMuted, fontSize: 10, dy: 30 }}
              />

              <Tooltip
                content={<SleepDurationTooltip t={t} />}
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
                name={t("recovery.trends.sleepDuration.label") as string}
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

              <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <EventsLegend t={t} />
    </section>
  );
}