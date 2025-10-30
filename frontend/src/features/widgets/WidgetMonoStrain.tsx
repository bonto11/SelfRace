// src/features/widgets/MonoStrainWidget.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import LoadingSpinner from "@/shared/components/icons/LoadingSpinner"; // NEW

function classifyMonotony(v?: number | null) {
  if (v == null) return { label: "—", accent: "bg-slate-700" };
  if (v < 0.8)
    return { label: "nízka variabilita (OK)", accent: "bg-emerald-600" };
  if (v <= 1.5) return { label: "vyvážené (OK)", accent: "bg-emerald-600" };
  if (v <= 2.0) return { label: "vyššia monotónnosť", accent: "bg-amber-500" };
  return { label: "riziko preťaženia", accent: "bg-red-600" };
}

function classifyStrain(v?: number | null) {
  if (v == null) return { label: "—", accent: "bg-slate-700" };
  if (v < 600) return { label: "ľahší týždeň", accent: "bg-blue-700" };
  if (v < 1200) return { label: "stredný load", accent: "bg-emerald-600" };
  if (v < 1800) return { label: "vyšší load", accent: "bg-amber-500" };
  return { label: "veľmi vysoký", accent: "bg-red-600" };
}

function fmtRange(s: string, e: string) {
  const sd = new Date(s),
    ed = new Date(e);
  const sdD = sd.getDate(),
    sdM = sd.getMonth() + 1;
  const edD = ed.getDate(),
    edM = ed.getMonth() + 1;
  return sdM === edM
    ? `${sdD}–${edD}.${edM}.`
    : `${sdD}.${sdM}.–${edD}.${edM}.`;
}

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  // počítame na základe ČASU (minúty). Ak budeš chcieť TRIMP, stačí zmeniť na "trimp".
  const r7 = rolling7("time");
  const mono = useMemo(() => r7.last.mono ?? null, [r7]);
  const strain = useMemo(() => r7.last.strain ?? null, [r7]);

  const mC = classifyMonotony(mono);
  const sC = classifyStrain(strain);

  const accent =
    mC.accent === "bg-red-600" || sC.accent === "bg-red-600"
      ? "bg-red-600"
      : mC.accent === "bg-amber-500" || sC.accent === "bg-amber-500"
      ? "bg-amber-500"
      : mC.accent === "bg-emerald-600" || sC.accent === "bg-emerald-600"
      ? "bg-emerald-600"
      : "bg-slate-700";

  return (
    <OpenerWidget title={title} accent={accent} onOpenDetail={onOpenDetail}>
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" /> {/* NEW */}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs opacity-80 mb-1">Monotony</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold leading-none tabular-nums">
                  {mono == null ? "—" : mono.toFixed(2)}
                </span>
              </div>
              <div className="opacity-80 text-xs mt-1">{mC.label}</div>
            </div>
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

          <div className="opacity-80 text-sm mt-2">
            Posledných 7 dní •{" "}
            {fmtRange(r7.last.range.start, r7.last.range.end)}
          </div>
        </>
      )}
    </OpenerWidget>
  );
}
