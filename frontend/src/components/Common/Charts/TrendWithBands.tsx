// src/components/common/TrendWithBands.tsx
"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { useMemo } from "react";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, annotationPlugin
);

type Point = { date: string; value: number | null };
export type Band  = { 
  label: string; 
  min: number | null; 
  max: number | null; 
  color: string 
};

interface Props {
  title: string;
  points: Point[];
  bands?: Band[];
  unit?: string;
  lineColor?: string;
  ySuggestedMin?: number;
  ySuggestedMax?: number;
  /** ✅ nové: umožní vlastné formátovanie Y-osi (napr. min→HH:MM) */
  yTickFormatter?: (v: number) => string;
}

export default function TrendWithBands({
  title,
  points,
  bands = [],
  unit = "",
  lineColor = "cyan",
  ySuggestedMin,
  ySuggestedMax,
  yTickFormatter,
}: Props) {
  const labels = useMemo(
    () => points.map(p => new Date(p.date).toLocaleDateString("sk-SK")),
    [points]
  );
  const dataVals = useMemo(() => points.map(p => p.value), [points]);

  const annotations = useMemo(() => {
    return bands.reduce((acc: any, b, idx) => {
      acc["band" + idx] = {
        type: "box",
        yMin: b.min ?? -Infinity,
        yMax: b.max ?? Infinity,
        backgroundColor: b.color + "33",
        borderWidth: 0,
      };
      return acc;
    }, {});
  }, [bands]);

  const data = useMemo(() => ({
    labels,
    datasets: [{
      label: title,
      data: dataVals,
      borderColor: lineColor,
      backgroundColor: lineColor,
      tension: 0.2,
    }],
  }), [labels, dataVals, lineColor, title]);

  const options: any = useMemo(() => ({
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
      },
    },
  }), [annotations, unit, yTickFormatter, ySuggestedMin, ySuggestedMax]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-4">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <Line data={data} options={options} />
    </div>
  );
}