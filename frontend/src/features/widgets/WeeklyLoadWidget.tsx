"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import WeeklyLoadMini from "@/features/widgets/WeeklyLoadMini";
import ChartScroller from "@/features/widgets/ChartScroller";

ensureChartJSRegistered();

type WeekRow = {
  week: string; label: string; start: string; end: string;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  monotony: { time?: number }; strain: { time?: number };
};

const C = {
  run:"#22D3EE", bike:"#A78BFA", strength:"#F59E0B",
  mixed:"#34D399", skate:"#60A5FA", other:"#9CA3AF",
  monotony:"#84CC16", strain:"#FDE047",
};
const a = (hex:string, alpha:number) =>
  `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;

const fmtMin = (m:number)=>{const mm=Math.round(m||0); if(mm<60) return `${mm} min`; const h=Math.floor(mm/60), r=mm%60; return r?`${h} h ${r} min`:`${h} h`;};

type DetailRange = 4 | 12 | 52;
const isDecemberNow = () => new Date().getMonth() === 11;

export type WeekPick = { week: string; start: string; end: string };

export default function WeeklyLoadWidget({
  title = "Weekly Load",
  onPickWeek,
}: {
  title?: string;
  onPickWeek?: (w: WeekPick) => void;
}) {
  const { userId } = useUserId();
  const [detailOpen, setDetailOpen] = useState(false);
  const [range, setRange] = useState<DetailRange>(4);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const allowYear = isDecemberNow();

  // mini = 2 týždne; detail = 4/12/(52 v decembri)
  const fetchSpan = detailOpen ? range : THEME.mobile.miniWeeks;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=${fetchSpan}`);
        const json = await res.json().catch(()=>({}));
        const raw:any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        const num = (v:any)=>(Number.isFinite(+v)?+v:0);
        const norm:WeekRow[] = raw.map(w=>({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "", end: w.end ?? "",
          time_run_min:      num(w.time_run_min ?? w.run_min),
          time_ride_min:     num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_mixed_min:    num(w.time_mixed_min),
          time_skate_min:    num(w.time_skate_min),
          time_other_min:    num(w.time_other_min ?? w.other_min),
          monotony: w.monotony ?? {},
          strain:   w.strain ?? {},
        }));
        setWeeks(norm);
      } finally { setLoading(false); }
    })();
  }, [userId, fetchSpan]);

  // labels + indexy
  const labels = useMemo(()=>weeks.map(w=>w.label || w.week), [weeks]);
  const mono   = useMemo(()=>weeks.map(w=>w.monotony?.time ?? null), [weeks]);
  const strn   = useMemo(()=>weeks.map(w=>w.strain?.time ?? null),   [weeks]);
  const monoMax   = mono.some(v=>v!=null)? Math.max(1, ...mono.filter((v):v is number=>v!=null)) : 3;
  const strainMax = strn.some(v=>v!=null)? Math.max(1, ...strn.filter((v):v is number=>v!=null)) : 10;

  // ktoré športy sa reálne vyskytli (sum > 0)
  const sum = (arr:number[]) => arr.reduce((s,v)=>s+(v||0),0);
  const sRun      = sum(weeks.map(w=>w.time_run_min))      > 0;
  const sBike     = sum(weeks.map(w=>w.time_ride_min))     > 0;
  const sStrength = sum(weeks.map(w=>w.time_strength_min)) > 0;
  const sMixed    = sum(weeks.map(w=>w.time_mixed_min))    > 0;
  const sSkate    = sum(weeks.map(w=>w.time_skate_min))    > 0;
  const sOther    = sum(weeks.map(w=>w.time_other_min))    > 0;

  // datasets (iba prítomné), rozmery priamo v datasetoch → žiadny TS problém
  const datasets = useMemo(()=>{
    const W = weeks; const ds:any[] = [];
    const pushBar=(label:string, data:number[], color:string)=>ds.push({
      type:"bar" as const, label, data,
      backgroundColor:a(color,0.85), borderColor:color, borderWidth:1, yAxisID:"y",
      maxBarThickness:12, categoryPercentage:0.6, barPercentage:0.7,
    });
    if (sRun)      pushBar("Run",      W.map(w=>w.time_run_min),      C.run);
    if (sBike)     pushBar("Bike",     W.map(w=>w.time_ride_min),     C.bike);
    if (sStrength) pushBar("Strength", W.map(w=>w.time_strength_min), C.strength);
    if (sMixed)    pushBar("Mixed",    W.map(w=>w.time_mixed_min),    C.mixed);
    if (sSkate)    pushBar("Skate",    W.map(w=>w.time_skate_min),    C.skate);
    if (sOther)    pushBar("Other",    W.map(w=>w.time_other_min),    C.other);

    // indexy ponechávame v grafe (bez legendy)
    ds.push({ type:"line" as const, label:"Monotony", data:mono, yAxisID:"y1",
      borderColor:C.monotony, backgroundColor:C.monotony, tension:0.3, pointRadius:2, borderWidth:3, spanGaps:true, order:99 });
    ds.push({ type:"line" as const, label:"Strain", data:strn, yAxisID:"y2",
      borderColor:C.strain, backgroundColor:C.strain, tension:0.3, pointRadius:2, borderWidth:3, borderDash:[4,4], spanGaps:true, order:99 });

    return ds;
  },[weeks, sRun, sBike, sStrength, sMixed, sSkate, sOther, mono, strn]);

  const options: ChartOptions<"bar"|"line"> = {
    responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
    plugins:{
      legend:{ display:false }, // natívnu legendu vypíname
      tooltip:{ callbacks:{ label:(ctx)=>{
        const label=ctx.dataset.label||""; const v=(ctx.parsed.y??0) as number;
        if (ctx.dataset.yAxisID==="y1") return `${label}: ${v.toFixed?.(2) ?? v}`;
        if (ctx.dataset.yAxisID==="y2") return `${label}: ${Math.round(v)}`;
        return `${label}: ${fmtMin(v)}`;
      }}},
    },
    layout:{ padding:{ left:8, right:16 }},
    onClick:(_evt, els)=>{
      const idx = els?.[0]?.index; if (idx==null) return;
      const w = weeks[idx]; if(!w) return;
      setPickedWeek(w.week);
      onPickWeek?.({ week:w.week, start:w.start, end:w.end });
    },
    scales:{
      y:{ beginAtZero:true, title:{ display:true, text:"min" }, grid:{ color:THEME.chart.grid }},
      y1:{ position:"right", min:0, max:Math.max(3, Math.ceil(monoMax+0.5)), grid:{ drawOnChartArea:false }, title:{ display:true, text:"Monotony" }},
      y2:{ position:"right", min:0, max:Math.ceil(strainMax*1.1), grid:{ drawOnChartArea:false }, title:{ display:true, text:"Strain" }},
      x:{ grid:{ color:THEME.chart.gridSoft }, ticks:{ maxRotation:0, autoSkip:true, maxTicksLimit:8 }},
    }
  };

  const data: ChartData<"bar"|"line", number[], string> = { labels, datasets };

  // vlastná minimalistická legenda – len športy (žiadne Mono/Strain)
  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2">
      {sRun      && <span style={{ color: C.run }}>Run</span>}
      {sBike     && <span style={{ color: C.bike }}>Bike</span>}
      {sStrength && <span style={{ color: C.strength }}>Strength</span>}
      {sMixed    && <span style={{ color: C.mixed }}>Mixed</span>}
      {sSkate    && <span style={{ color: C.skate }}>Skate</span>}
      {sOther    && <span style={{ color: C.other }}>Other</span>}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold opacity-90">{title}</h3>
        <div className="flex items-center gap-2">
          <button onClick={()=>setDetailOpen(v=>!v)} className="text-xs px-2 py-1 rounded bg-gray-700">
            {detailOpen ? "Skryť detail" : "Detail"}
          </button>
          {detailOpen && (
            <select
              value={range}
              onChange={(e)=>setRange(Number(e.target.value) as DetailRange)}
              className="text-xs px-2 py-1 rounded bg-gray-700"
              title="Rozsah detailu"
            >
              <option value={4}>1 mesiac</option>
               <option value={8}>2 mesiace</option>
              <option value={12}>3 mesiace</option>
              {isDecemberNow() && <option value={52}>Celý rok</option>}
            </select>
          )}
        </div>
      </div>

      {legend}

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : !detailOpen ? (
        <WeeklyLoadMini data={data} options={options} />
      ) : (
        <ChartScroller labels={data.labels as string[]} height={THEME.chart.weeklyHeight} pxPerLabel={26}>
          <MixedChart type="bar" data={data} options={options} />
        </ChartScroller>
      )}

      {pickedWeek && (
        <WeeklySummary weeks={weeks as any} metric={"time"} selectedWeek={pickedWeek} hideTitle />
      )}
    </div>
  );
}
