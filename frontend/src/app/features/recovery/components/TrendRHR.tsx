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
import {
  rollingMean,
  bandsAround,
  wrapToLines,
} from "@/app/shared/utils/recovery";
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

function iso(d: Date) {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10);
}

function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1))
    out.push(iso(d));
  return out;
}

const RecoveryTooltip = ({ active, payload, label, t }: any) => {
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
            <span className="opacity-90">RHR:</span>
            <span className="font-bold">{Math.round(mainData.value)} {t("common.units.hr")}</span>
          </div>
        ) : missingData ? (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span className="opacity-90">
              {t("recovery.trends.rhr.noRecord")}
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

export default function TrendRHR() {
  const t = useT();
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

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
  const endISO = useMemo(() => all.at(-1)?.date ?? iso(new Date()), [all]);
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setUTCDate(d.getUTCDate() - (days - 1));
    return iso(d);
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

  const rhr = useMemo(
    () =>
      labelsISO.map((d) => {
        const rec = byDate.get(d);
        return typeof rec?.RHR_bpm === "number" ? rec.RHR_bpm : NaN;
      }),
    [labelsISO, byDate],
  );

  const baselineArr = useMemo(
    () =>
      rollingMean(
        rhr.map((v) => (Number.isFinite(v) ? (v as number) : null)),
        14,
      ),
    [rhr],
  );
  const { lower, upper } = useMemo(
    () => bandsAround(baselineArr, 0.05),
    [baselineArr],
  );

  const missingY = useMemo(() => {
    const n = rhr.length;
    const out = new Array<number | null>(n).fill(null);
    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(rhr[i])) last = i;
      nextKnown[i] = last;
    }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(rhr[i])) {
        prev = i;
        continue;
      }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = rhr[prev] as number;
        const vn = rhr[nxt] as number;
        y = vp + (vn - vp) * ((i - prev) / (nxt - prev));
      } else if (prev !== -1) y = rhr[prev] as number;
      else if (nxt !== -1) y = rhr[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [rhr]);

  const chartData = useMemo(() => {
    return labelsISO.map((d, i) => {
      const v = rhr[i];
      const isMissing = !Number.isFinite(v);
      const hasBand = lower[i] != null && upper[i] != null;
      
      return {
        date: d,
        val: isMissing ? null : v,
        bandRange: hasBand ? [lower[i], upper[i]] : null,
        missingY: isMissing ? missingY[i] : null,
        comments: byDate.get(d)?.comments,
      };
    });
  }, [labelsISO, rhr, lower, upper, missingY, byDate]);

  const validValues = [
    ...rhr.filter(Number.isFinite),
    ...lower.filter((v): v is number => v !== null),
    ...upper.filter((v): v is number => v !== null),
  ];
  const minValue = validValues.length ? Math.min(...validValues) : 40;
  const maxValue = validValues.length ? Math.max(...validValues) : 80;

  const yMin = Math.max(30, Math.floor((minValue - 5) / 5) * 5);
  const yMax = Math.ceil((maxValue + 5) / 5) * 5;

  const yAxisLabel = `[${t("common.units.hr")}]`;

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
            {t("recovery.trends.rhr.title")}
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            {t("recovery.trends.rhr.subtitle")}
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

      <div className="CARD_BODY_INSET">
        <div className="w-full relative" style={{ height: 320 }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            {/* ✅ Okraj zväčšený na 10, aby sa vpratal label */}
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
                domain={[yMin, yMax]}
                tick={{ fill: appColors.textMuted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                // ✅ Pridaná jednotka pre os Y
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: appColors.textMuted, fontSize: 10, dy: 30 }}
              />

              <Tooltip
                content={<RecoveryTooltip t={t} />}
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
                name={t("recovery.trends.rhr.rhrLabel") as string}
                stroke={COLOR.main}
                strokeWidth={3}
                dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
              <Scatter
                dataKey="missingY"
                name={t("recovery.trends.rhr.missingLabel") as string}
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