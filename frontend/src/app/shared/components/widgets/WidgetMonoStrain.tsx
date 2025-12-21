// src/features/widgets/MonoStrainWidget.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import { fmtRange } from "@/app/shared/utils/time";

function classifyMonotony(v?: number | null) {
  if (v == null || !Number.isFinite(v))
    return { label: "—", accent: "bg-slate-700" };
  if (v < 0.8)
    return { label: "nízka variabilita (OK)", accent: "bg-emerald-600" };
  if (v <= 1.5) return { label: "vyvážené (OK)", accent: "bg-emerald-600" };
  if (v <= 2.0) return { label: "vyššia monotónnosť", accent: "bg-amber-500" };
  return { label: "riziko preťaženia", accent: "bg-red-600" };
}

function classifyStrain(v?: number | null) {
  if (v == null || !Number.isFinite(v))
    return { label: "—", accent: "bg-slate-700" };
  if (v < 600) return { label: "ľahší týždeň", accent: "bg-blue-700" };
  if (v < 1200) return { label: "stredný load", accent: "bg-emerald-600" };
  if (v < 1800) return { label: "vyšší load", accent: "bg-amber-500" };
  return { label: "veľmi vysoký", accent: "bg-red-600" };
}

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  // môže byť undefined, tak ošetri
  const r7 = rolling7?.("time");
  const mono = useMemo(() => (r7?.last?.mono ?? null) as number | null, [r7]);
  const strain = useMemo(
    () => (r7?.last?.strain ?? null) as number | null,
    [r7]
  );

  const mC = classifyMonotony(mono);
  const sC = classifyStrain(strain);

  // accent = najhoršia z dvoch farieb (red > amber > emerald > fallback)
  const accent = [mC.accent, sC.accent].includes("bg-red-600")
    ? "bg-red-600"
    : [mC.accent, sC.accent].includes("bg-amber-500")
    ? "bg-amber-500"
    : [mC.accent, sC.accent].includes("bg-emerald-600")
    ? "bg-emerald-600"
    : "bg-slate-700";

  const rangeTxt = r7?.last?.range
    ? fmtRange(r7.last.range.start, r7.last.range.end)
    : "—";

  return (
    <WidgetCard
      title={title}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : r7?.last ? (
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
            Posledných 7 dní • {rangeTxt}
          </div>
        </>
      ) : (
        <div className="opacity-75 text-sm py-6">
          Dáta pre posledných 7 dní nie sú k dispozícii.
        </div>
      )}
    </WidgetCard>
  );
}
