"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";
import type { DayAbbrev } from "@/features/coach/types/day";

function Chip({ text }: { text: string }) {
  return <span className="px-2 py-0.5 rounded bg-gray-700 text-xs">{text}</span>;
}

function DayRow({ label, days }: { label: string; days?: DayAbbrev[] }) {
  if (!days || !days.length) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-70">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {days.map((d) => <Chip key={d} text={d} />)}
      </div>
    </div>
  );
}

export default function WidgetCoachPrefs({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { prefs } = useCoachData();

  // stručné zhrnutie
  const goal =
    prefs.goal_text_override ??
    (prefs.goal_kind ? String(prefs.goal_kind).replaceAll("_", " ") : "—");

  const sports = (prefs.primary_sports ?? prefs.sports ?? []).join(", ") || "—";
  const weeks  = prefs.weeks ?? "—";
  const pref   = prefs.preferences;

  const accent =
    pref?.avoid_back_to_back_hard ? "bg-emerald-600" : "bg-slate-700";

  return (
    <OpenerWidget title="Coach – Preferences" accent={accent} onOpenDetail={onOpenDetail}>
      <div className="space-y-2 text-sm">
        <div><span className="opacity-70">Goal:</span> <strong className="ml-1 capitalize">{goal}</strong></div>
        <div><span className="opacity-70">Weeks:</span> <strong className="ml-1">{weeks}</strong></div>
        <div><span className="opacity-70">Sports:</span> <strong className="ml-1">{sports}</strong></div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-xs opacity-80">Use zones: <strong>{pref?.use_zones ? "Yes" : "No"}</strong></div>
          <div className="text-xs opacity-80">WU/CD detail: <strong>{pref?.wu_cd_detail ? "Yes" : "No"}</strong></div>
          <div className="text-xs opacity-80">Avoid back-to-back hard: <strong>{pref?.avoid_back_to_back_hard ? "Yes" : "No"}</strong></div>
        </div>

        <DayRow label="Days off" days={pref?.days_off} />
        {!!pref?.long_run_days?.length && <DayRow label="Long-run days" days={pref?.long_run_days} />}
      </div>
    </OpenerWidget>
  );
}