// src/components/Recovery/TrendSleepDuration.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import { isoDate, minutesToHhMm, wrapTextToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = { date: string; sleep_duration_min: number | null; note?: string | null };

export default function DetailSleepDuration() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState(8);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      arr.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
      setRows(arr);
    })();
  }, [userId, weeks]);

  const labelsISO = useMemo(()=>rows.map(r=>isoDate(r.date)),[rows]);
  const mins = useMemo(()=>rows.map(r=>r.sleep_duration_min ?? null),[rows]);

  const minBand = 420; // 7h
  const maxBand = 540; // 9h

  const comments = useMemo(()=>{
    const m = new Map<string,string>();
    for (const r of rows) if (r.note) m.set(isoDate(r.date), r.note);
    return m;
  },[rows]);

  const data = useMemo(()=>({
    labels: labelsISO,
    datasets: [
      { type:"line" as const, label:"7h", data: labelsISO.map(()=>minBand), borderColor:"transparent", pointRadius:0, fill:"+1", backgroundColor:"rgba(34,197,94,0.18)" },
      { type:"line" as const, label:"9h", data: labelsISO.map(()=>maxBand), borderColor:"transparent", pointRadius:0, fill:"-1", backgroundColor:"rgba(34,197,94,0.18)" },
      { type:"line" as const, label:"Sleep", data: mins, borderColor:"#8b5cf6", backgroundColor:"#8b5cf6", pointRadius:3, tension:0.25 },
    ],
  }),[labelsISO, mins]);

  const options = useMemo(()=>buildRecoveryLineOptions({
    labelsISO,
    yTitle:"min",
    yTickFormatter:(v)=>minutesToHhMm(v),
    tooltipLabelForItem:(ctx)=>{
      const idx = ctx.dataIndex ?? 0;
      const iso = labelsISO[idx] ?? "";
      if (ctx.datasetIndex === 2) {
        const v = mins[idx];
        const lines = [`Spánok: ${isFinite(v as number) ? minutesToHhMm(v as number) : "—"}`];
        const c = comments.get(iso); if (c) lines.push(...wrapTextToLines(c,44));
        return lines;
      }
      return "";
    },
    tooltipFilter:(it)=>it.datasetIndex === 2,
  }),[labelsISO, mins, comments]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Sleep duration</h2>
        <div className="flex items-center gap-2">
          <span className="opacity-70 text-sm">Rozsah:</span>
          <select value={weeks} onChange={(e)=>setWeeks(Number(e.target.value))} className="px-2 py-1 rounded bg-gray-700 text-sm">
            <option value={2}>2 týždne</option><option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option><option value={12}>12 týždňov</option>
          </select>
          <button onClick={()=>history.back()} className="px-3 py-1 rounded bg-gray-700">Späť</button>
        </div>
      </div>
      <div style={{height:360}}><Line data={data} options={options} /></div>
    </div>
  );
}
