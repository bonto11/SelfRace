"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { useMemo } from "react";
import { SURFACE_SUBCARD } from "@/app/shared/theme/uiTokens";
import { CHART_TREND } from "@/app/shared/theme/uiTokens";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

export type Point = { date: string; value: number | null };
export type Band = {
  label: string;
  min: number | null;
  max: number | null;
  color: string; // hex / rgba / hsl
};

interface Props {
  title: string;
  points: Point[];
  bands?: Band[];
  unit?: string;
  lineColor?: string;
  ySuggestedMin?: number;
  ySuggestedMax?: number;
  /** vlastný formatter Y-osi (napr. s → HH:MM) */
  yTickFormatter?: (v: number) => string;
}

export default function TrendWithBands({
  title,
  points,
  bands = [],
  unit = "",
  lineColor,
  ySuggestedMin,
  ySuggestedMax,
  yTickFormatter,
}: Props) {
  const labels = useMemo(
    () => points.map((p) => new Date(p.date).toLocaleDateString("sk-SK")),
    [points]
  );
  const dataVals = useMemo(() => points.map((p) => p.value), [points]);

  const annotations = useMemo(() => {
    return bands.reduce((acc: any, b, idx) => {
      // priesvitnosť pásma – pridáme alpha, ak je to hex bez alpha
      const bg =
        b.color.startsWith("#") && b.color.length === 7
          ? b.color + CHART_TREND.bandAlphaHex
          : b.color;
      acc["band" + idx] = {
        type: "box",
        yMin: b.min ?? -Infinity,
        yMax: b.max ?? Infinity,
        backgroundColor: bg,
        borderWidth: 0,
      };
      return acc;
    }, {});
  }, [bands]);

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: title,
          data: dataVals,
          borderColor: lineColor ?? CHART_TREND.lineColor,
          backgroundColor: lineColor ?? CHART_TREND.lineColor,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }),
    [labels, dataVals, lineColor, title]
  );

  const options: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false },
        annotation: { annotations },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed.y;
              if (v == null) return "";
              if (yTickFormatter) return yTickFormatter(v);
              return unit ? `${v} ${unit}` : `${v}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { maxRotation: 0 },
          grid: { display: false },
        },
        y: {
          beginAtZero: false,
          suggestedMin: ySuggestedMin,
          suggestedMax: ySuggestedMax,
          ticks: {
            callback: (val: any) => {
              const num = Number(val);
              if (yTickFormatter) return yTickFormatter(num);
              return unit ? `${num} ${unit}` : `${num}`;
            },
          },
          grid: { color: "rgba(255,255,255,.12)" },
        },
      },
    }),
    [annotations, unit, yTickFormatter, ySuggestedMin, ySuggestedMax]
  );

  return (
    <div className={`${SURFACE_SUBCARD} p-4 ${CHART_TREND.containerClass}`}>
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <Line data={data} options={options} />
    </div>
  );
}
