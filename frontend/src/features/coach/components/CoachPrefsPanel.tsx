"use client";

import { useCoachData } from "@/features/coach/data/CoachDataProvider";
import { THEME } from "@/shared/theme/tokens";

export default function CoachPrefsPanel() {
  const { prefs } = useCoachData();
  const p = prefs.preferences;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h2 className="text-lg font-semibold">Preferences (detail)</h2>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div><span className="opacity-70">Goal kind:</span> <span className="ml-1">{prefs.goal_kind ?? "—"}</span></div>
        <div><span className="opacity-70">Weeks:</span> <span className="ml-1">{prefs.weeks ?? "—"}</span></div>
        <div><span className="opacity-70">Sports:</span> <span className="ml-1">{(prefs.primary_sports ?? prefs.sports ?? []).join(", ") || "—"}</span></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>Use zones: <strong>{p?.use_zones ? "Yes" : "No"}</strong></div>
        <div>WU/CD detail: <strong>{p?.wu_cd_detail ? "Yes" : "No"}</strong></div>
        <div>Avoid back-to-back hard: <strong>{p?.avoid_back_to_back_hard ? "Yes" : "No"}</strong></div>
      </div>

      <div className="text-xs opacity-80">
        {/* TODO: sem pôjde reálny editačný formulár (selecty na days_off, long_run_days, atď.) */}
        <em>Form coming soon – wire up to Supabase & adapters.</em>
      </div>
    </div>
  );
}