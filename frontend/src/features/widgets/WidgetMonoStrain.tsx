// src/features/widgets/MonoStrainWidget.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import OpenerWidget from "@/features/widgets/OpenerWidget";

function classifyMonotony(v?: number | null) {
  if (v == null) return { label: "—", accent: "bg-slate-700" };
  if (v < 0.8)  return { label: "nízka variabilita (OK)", accent: "bg-emerald-600" };
  if (v <= 1.5) return { label: "vyvážené (OK)",          accent: "bg-emerald-600" };
  if (v <= 2.0) return { label: "vyššia monotónnosť",      accent: "bg-amber-500" };
  return           { label: "riziko preťaženia",           accent: "bg-red-600" };
}

function classifyStrain(v?: number | null) {
  if (v == null) return { label: "—", accent: "bg-slate-700" };
  if (v < 600)   return { label: "ľahší týždeň",  accent: "bg-blue-700" };
  if (v < 1200)  return { label: "stredný load", accent: "bg-emerald-600" };
  if (v < 1800)  return { label: "vyšší load",   accent: "bg-amber-500" };
  return             { label: "veľmi vysoký",    accent: "bg-red-600" };
}

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { weeks, loading } = useActivityData();

  const last = weeks.at(-1);
  const mono = useMemo(
    () => (last?.monotony?.time != null ? Number(last.monotony.time) : null),
    [last]
  );
  const strain = useMemo(
    () => (last?.strain?.time != null ? Number(last.strain.time) : null),
    [last]
  );

  const mC = classifyMonotony(mono);
  const sC = classifyStrain(strain);

  // vyber horší signál ako akcent karty
  const accent =
    (mC.accent === "bg-red-600" || sC.accent === "bg-red-600") ? "bg-red-600" :
    (mC.accent === "bg-amber-500" || sC.accent === "bg-amber-500") ? "bg-amber-500" :
    (mC.accent === "bg-emerald-600" || sC.accent === "bg-emerald-600") ? "bg-emerald-600" :
    "bg-slate-700";

  return (
    <OpenerWidget title={title} accent={accent} onOpenDetail={onOpenDetail}>
      {loading || !last ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6">
            {/* Monotony */}
            <div>
              <div className="text-xs opacity-80 mb-1">Monotony</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold leading-none tabular-nums">
                  {mono == null ? "—" : mono.toFixed(2)}
                </span>
              </div>
              <div className="opacity-80 text-xs mt-1">{mC.label}</div>
            </div>
            {/* Strain */}
            <div>
              <div className="text-xs opacity-80 mb-1">Strain</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold leading-none tabular-nums">
                  {strain == null ? "—" : Math.round(strain)}
                </span>
              </div>
              <div className="opacity-80 text-xs mt-1">{sC.label}</div>
            </div>
          </div>

          <div className="opacity-80 text-sm mt-2">{last.label || last.week}</div>
        </>
      )}
    </OpenerWidget>
  );
}