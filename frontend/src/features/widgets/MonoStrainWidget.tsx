"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import ChartScroller from "@/features/widgets/ChartScroller";

ensureChartJSRegistered();

const C = { mono:"#84CC16", strain:"#FDE047" };

type Row = { label:string; week:string; start:string; end:string; monotony?:{time?:number}; strain?:{time?:number} };

function wowLabel(curr:number|undefined, prev:number|undefined, kind:"mono"|"strain"){
  if (curr==null || prev==null) return "—";
  const diff = curr - prev;
  if (kind==="mono") {
    const ad = Math.abs(diff);
    if (ad < 0.1) return "stabilná";
    return diff > 0 ? "rastúca" : "klesajúca";
  }
  // strain: percentuálne
  const pct = prev === 0 ? 0 : diff/prev;
  if (Math.abs(pct) < 0.1) return "stabilná";
  return diff > 0 ? "rastúca" : "klesajúca";
}

export default function MonoStrainWidget({ title="Load Indices" }: { title?: string }) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // 3 mesiace stačia (12 týždňov)
  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      try{
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=12`);
        const json = await res.json().catch(()=>({}));
        const raw:any[] = Array.isArray(json?.weeks)?json.weeks:(Array.isArray(json?.data)?json.data:[]);
        const norm:Row[] = raw.map(w=>({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "", end: w.end ?? "",
          monotony: w.monotony ?? {}, strain: w.strain ?? {},
        }));
        setRows(norm);
      } finally { setLoading(false); }
    })();
  },[userId]);

  const labels = useMemo(()=>rows.map(r=>r.label||r.week), [rows]);
  const mono = useMemo(()=>rows.map(r=>r.monotony?.time ?? null), [rows]);
  const strain = useMemo(()=>rows.map(r=>r.strain?.time ?? null), [rows]);

  const monoMax = mono.some(v=>v!=null)? Math.max(1, ...mono.filter((v):v is number=>v!=null)) : 3;
  const strainMax = strain.some(v=>v!=null)? Math.max(1, ...strain.filter((v):v is number=>v!=null)) : 10;

  const data: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      { type:"line", label:"Monotony", data: mono as number[], borderColor:C.mono, backgroundColor:C.mono, tension:0.3, pointRadius:2, borderWidth:3, spanGaps:true, yAxisID:"y1" },
      { type:"line", label:"Strain",   data: strain as number[], borderColor:C.strain, backgroundColor:C.strain, tension:0.3, pointRadius:2, borderWidth:3, borderDash:[4,4], spanGaps:true, yAxisID:"y2" },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
    plugins:{ legend:{ display:false } },
    scales:{
      y1:{ position:"left",  min:0, max:Math.max(3, Math.ceil(monoMax+0.5)),  grid:{ color:THEME.chart.grid }, title:{ display:true, text:"Monotony" }},
      y2:{ position:"right", min:0, max:Math.ceil(strainMax*1.1), grid:{ drawOnChartArea:false }, title:{ display:true, text:"Strain" }},
      x:{ grid:{ color:THEME.chart.gridSoft }, ticks:{ maxRotation:0, autoSkip:true, maxTicksLimit:8 } },
    },
  };

  // WoW text
  const n = labels.length;
  const wowMono = wowLabel(mono[n-1] ?? undefined, mono[n-2] ?? undefined, "mono");
  const wowStrn = wowLabel(strain[n-1] ?? undefined, strain[n-2] ?? undefined, "strain");

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-90">{title}</h3>
        <div className="text-xs flex gap-3">
          <span style={{color:C.mono}}>Monotony</span>
          <span style={{color:C.strain}}>Strain</span>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <ChartScroller labels={labels} height={THEME.chart.weeklyHeightCompact*1.2} pxPerLabel={26}>
          <LineChart type="line" data={data} options={options} />
        </ChartScroller>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border border-gray-700 p-3">
          <div className="opacity-70 mb-1">Monotony (WoW)</div>
          <div className="font-semibold">{wowMono}</div>
        </div>
        <div className="rounded border border-gray-700 p-3">
          <div className="opacity-70 mb-1">Strain (WoW)</div>
          <div className="font-semibold">{wowStrn}</div>
        </div>
      </div>
    </div>
  );
}
