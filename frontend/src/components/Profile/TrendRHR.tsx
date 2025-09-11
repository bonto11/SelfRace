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
import rhrRef from "@/data/RHR_Ref_VerywellFit.json";

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
  RHR: number | null;
  updated_at: string;
}
interface Range {
  label: string;
  min: number | null;
  max: number | null;
  color: string;
}

export default function TrendRHR() {
  const { userId } = useUserId();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const res = await fetch(`${API_URL}/profile/rhr-history/${userId}`);
      const json = await res.json();
      if (json.success) {
        setHistory(json.history);
        setSex(json.sex);
        setBirthDate(json.birth_date);
      }
    }
    load();
  }, [userId]);

  if (!history.length) return <div>Načítavam RHR...</div>;

  const latestRHR = history[history.length - 1]?.RHR ?? null;

  // vek & skupina z JSONu
  const age = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  );
  const group = (rhrRef as any[]).find(
    (g) => g.sex === sex && age >= g.age_min && age <= g.age_max
  );
  const ranges: Range[] = group?.ranges ?? [];

  // aktuálna kategória
  let currentLabel: string | null = null;
  if (latestRHR != null && ranges.length) {
    for (const r of ranges) {
      if (
        (r.min == null || latestRHR >= r.min) &&
        (r.max == null || latestRHR <= r.max)
      ) {
        currentLabel = r.label.trim();
        break;
      }
    }
  }

  // dáta do grafu
  const data = {
    labels: history.map((h) =>
      new Date(h.updated_at).toLocaleDateString("sk-SK")
    ),
    datasets: [
      {
        label: "Resting HR",
        data: history.map((h) => h.RHR),
        borderColor: "orange",
        backgroundColor: "orange",
        tension: 0.2,
      },
    ],
  };

  // podfarbené pásma + tooltip priamo na pásmach
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
            const min = r.min ?? "≥";
            const max = r.max ?? "≤";
            return `${r.label}: ${min}–${max} bpm`;
          },
        },
      },
    };
    return acc;
  }, {});

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false }, // skryjeme dataset legendu
      annotation: { annotations },
      tooltip: { enabled: true },
    },
    scales: {
      y: { beginAtZero: false, suggestedMin: 40, suggestedMax: 100 },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-4">
      <h2 className="text-lg font-bold mb-2">Trend Resting HR</h2>
      <div className="flex">
        {/* graf */}
        <div className="w-3/4">
          <Line data={data} options={options} />
        </div>

        {/* “Legenda” s kategóriami (bez čísel), čísla sú v title tooltipe */}
        <div className="w-1/4 pl-4 flex flex-col justify-center">
          {ranges.map((r, idx) => {
            const title = `${r.min ?? "≥"}–${r.max ?? "≤"} bpm`; // tooltip po nabehnutí myšou
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
    </div>
  );
}
