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
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json"; // JSON file

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
  VO2Max: number | null;
  updated_at: string;
}

export default function TrendVO2Max() {
  const { userId } = useUserId();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    async function load() {
      console.log("[FE] Načítavam VO2 históriu pre userId:", userId);
      const res = await fetch(`${API_URL}/profile/vo2-history/${userId}`);
      const json = await res.json();
      console.log("[FE] API response json:", json);

      if (json.success) {
        setHistory(json.history);
        setSex(json.sex);
        setBirthDate(json.birth_date);
      }
    }
    load();
  }, [userId]);

  if (!history.length) return <div>Načítavam VO₂Max...</div>;

  // 🔄 vypočítaj vek
  const age = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  );
  console.log("[FE] Vypočítaný vek:", age);

  // 🔄 nájdi správne ranges podľa JSON
  const group = vo2Ref.find(
    (g) => g.sex === sex && age >= g.age_min && age <= g.age_max
  );
  console.log("[FE] Vybraný group:", group);

  const annotations =
    group?.ranges.reduce((acc: any, r: any, idx: number) => {
      console.log("[FE] Pridávam annotation:", r, "index:", idx);
      acc["range" + idx] = {
        type: "box",
        yMin: r.min ?? -Infinity,
        yMax: r.max ?? Infinity,
        backgroundColor: r.color + "33",
        borderWidth: 0,
        label: {
          display: true,
          content: r.label || "",
          position: "start",
          color: "#111",
        },
      };
      return acc;
    }, {}) ?? {};

  // 🔄 graf data
  const data = {
    labels: history.map((h) =>
      new Date(h.updated_at).toLocaleDateString("sk-SK")
    ),
    datasets: [
      {
        label: "VO₂Max",
        data: history.map((h) => h.VO2Max),
        borderColor: "cyan",
        backgroundColor: "cyan",
        tension: 0.2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      annotation: { annotations },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 70,
      },
    },
  };

  console.log("[FE] Final options:", options);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-4">
      <h2 className="text-lg font-bold mb-2">Trend VO₂Max</h2>
      <Line data={data} options={options} />
    </div>
  );
}