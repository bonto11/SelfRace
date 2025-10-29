"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import { THEME } from "@/shared/theme/tokens";
import type { CoachPrefs } from "@/features/coach/types";

function Chip({label}:{label:string}) {
  return <span className="px-2 py-0.5 rounded bg-gray-700 text-xs">{label}</span>;
}

const MOCK: CoachPrefs = {
  weeks: 8,
  sports: ["run","ride","strength"],
  daysOff: ["Mon","Fri"],
  longRunDays: ["Sat","Sun"],
  avoidTwoHardInRow: true,
  useZones: true,
  includeStrides: false,
};

export default function CoachPrefsWidget({ onOpenDetail }:{ onOpenDetail?:()=>void }) {
  const s = MOCK;

  return (
    <OpenerWidget title="Coach AI — Preferences" accent="bg-emerald-600" onOpenDetail={onOpenDetail}>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="opacity-70">Block:</span>
          <Chip label={`${s.weeks} weeks`} />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="opacity-70">Sports:</span>
          {s.sports.map(sp => <Chip key={sp} label={sp} />)}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="opacity-70">Days off:</span>
          {s.daysOff.length ? s.daysOff.map(d => <Chip key={d} label={d} />) : <span>—</span>}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="opacity-70">Long-run:</span>
          {s.longRunDays.map(d => <Chip key={d} label={d} />)}
        </div>

        <ul className="mt-2 text-xs list-disc pl-4 opacity-80">
          <li>{s.avoidTwoHardInRow ? "Avoid two hard days in a row" : "Two hard days allowed"}</li>
          <li>{s.useZones ? "Use HR/Pace zones in planning" : "Zones off"}</li>
          <li>{s.includeStrides ? "Include strides" : "No strides"}</li>
        </ul>

        <div className="h-1 rounded bg-gray-700 mt-2">
          {/* drobný “progress” placeholder – weekly height token použijeme ako štýl */}
          <div className="h-1 rounded bg-blue-600" style={{ width: "65%" }} />
        </div>
      </div>
    </OpenerWidget>
  );
}