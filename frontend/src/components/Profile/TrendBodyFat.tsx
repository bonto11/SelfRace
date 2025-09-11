"use client";

import { useEffect, useState } from "react";
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

import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";
import bodyFatRef from "@/data/BodyFat_Ref_ACE.json";

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

interface HistoryRow {
  body_fat_pct: number | null;
  updated_at: string;
}
interface Range {
  label: string;
  min: number | null;
  max: number | null;
  color: string;
}
interface Group {
  sex: "M" | "F";
  ranges: Range[];
}

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sex, setSex] = useState<"M" | "F">("M");

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const res = await fetch(`${API_URL}/profile/bodyfat-history/${userId}`);
      const json = await res.json();
      if (json.success) {
        setHistory(json.history);
        setSex(json.sex);
      }
    }
    load();
  }, [userId]);

  if (!history.length) return <div>Načítavam Body Fat %...</div>;

  // posledná BF a skupina podľa pohlavia
  const latestBF = history[history.length - 1]?.body_fat_pct ?? null;
  const group = (bodyFatRef as Group[]).find((g) => g.sex === sex);
  const ranges: Range[] = group?.ranges ?? [];

  // aktuálna kategória
  let currentLabel: string | null = null;
  if (latestBF != null && ranges.length) {
    for (const r of ranges) {
      if ((r.min == null || latestBF >= r.min) && (r.max == null || latestBF <= r.max)) {
        currentLabel = r.label.trim();
        break;
      }
    }
  }

  // scale z rozsahov (fallbacky)
  const maxFromRanges = Math.max(
    ...ranges.map((r) => (r.max == null ? 0 : r.max)),
    0
  );
  const suggestedMax = Math.max(30, Math.ceil(maxFromRanges + 2));

  // dáta
  const data = {
    labels: history.map((h) => new Date(h.updated_at).toLocaleDateString("sk-SK")),
    datasets: [
      {
        label: "Body Fat %",
        data: history.map((h) => h.body_fat_pct),
        borderColor: "orange",
        backgroundColor: "orange",
        tension: 0.2,
      },
    ],
  };

  // pásma + tooltip s rozsahom
  const annotations = ranges.reduce((acc: any, r: Range, idx: number) => {
    acc["range" + idx] = {
      type: "box",
      yMin: r.min ?? -Infinity,
      yMax: r.max ?? Infinity,
      backgroundColor: r.color + "33",
      borderWidth: 0,
      tooltip: {
        enabled: true,
        callbacks: {
          label: () => {
            const from = r.min ?? "≥";
            const to = r.max ?? "≤";
            return `${r.label}: ${from}–${to} %`;
          },
        },
      },
    };
    return acc;
  }, {});

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },      // skryjeme default legendu datasetu
      annotation: { annotations },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax,
        ticks: { callback: (v: any) => `${v}%` },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-4 flex">
      {/* graf */}
      <div className="w-3/4">
        <h2 className="text-lg font-bold mb-2">Trend Body Fat %</h2>
        <Line data={data} options={options} />
      </div>

      {/* vlastná “legenda” vpravo – bez čísel; rozsah v title */}
      <div className="w-1/4 ml-4 flex flex-col justify-center text-sm">
        {ranges
          .slice()
          .reverse() // nech sú „vyššie“ kategórie hore
          .map((r, idx) => {
            const title = `${r.min ?? "≥"}–${r.max ?? "≤"} %`;
            const isCurrent = currentLabel === r.label.trim();
            return (
              <div
                key={idx}
                className={`flex items-center mb-1 ${
                  isCurrent ? "font-bold text-blue-500" : ""
                }`}
                title={title}
              >
                <span
                  className={`inline-block w-4 h-4 mr-2 rounded ${
                    isCurrent ? "ring-2 ring-black dark:ring-white" : ""
                  }`}
                  style={{ backgroundColor: r.color }}
                />
                {r.label}
              </div>
            );
          })}
      </div>
    </div>
  );
}