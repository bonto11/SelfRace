// src/features/coach/components/CoachPreferencies/index.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CoachPrefs, GoalKind, SportKind,
  ExternalActivity, ExternalIntensity, ExternalSport,
  Injury, InjuryArea, InjuryType
} from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/shared/types/day";
import { useUserId } from "@/shared/hooks/useUserId";
import { toast } from "@/shared/components/ui/Toast";
import {
  readCoachPrefsFromStorage,
  refreshCoachPrefsFromDB,
  saveCoachPrefs,
} from "@/features/coach/utils/prefs";

const ALL_DAYS: DayAbbrev[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const ALL_SPORTS: SportKind[] = ["run","ride","strength"];
const ALL_GOALS: GoalKind[] = ["race_time","improve_speed","improve_endurance","improve_overall","maintain"];

/* helper „enumy“ pre advanced */
const EXT_SPORTS: ExternalSport[] = ["football","run","ride","strength","other"];
const EXT_INTENS: ExternalIntensity[] = ["low","moderate","high"];
const INJ_AREAS: InjuryArea[] = ["foot","ankle","shin","knee","hip","hamstring","calf","back","shoulder","other"];
const INJ_TYPES: InjuryType[] = ["overuse","acute","tendon","stress","shin_splints","plantar","itb","other"];
const FOCUS_CHOICES = [
  "ankle_strength","foot_intrinsics","calf_strength","hamstrings",
  "glutes","core_stability","thoracic_mobility","shoulder_stability"
];
const AVOID_CHOICES = ["impact_high","downhill_runs","hard_surfaces","back_to_back_speed"];

/* --- component --- */
export default function PrefsForm() {
  const { userId } = useUserId();

  // 1) init z localStorage (okamžité UI)
  const [local, setLocal] = useState<CoachPrefs>(() => readCoachPrefsFromStorage());
  // 2) po mount-e skús dotiahnuť DB a zosynchronizovať
  useEffect(() => {
    if (!userId) return;
    refreshCoachPrefsFromDB(userId).then(setLocal).catch(() => {});
  }, [userId]);

  const prevPrefs = (p: CoachPrefs) =>
    p.preferences ?? { days_off: [], long_run_days: [], avoid_back_to_back_hard: true, use_zones: true, wu_cd_detail: true };

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] => {
    const base = arr ?? [];
    return base.includes(v) ? base.filter(x => x !== v) : [...base, v];
  };

  const setPref = <K extends keyof CoachPrefs>(key: K, val: CoachPrefs[K]) =>
    setLocal(prev => ({ ...prev, [key]: val }));

  const setPrefNested = (path: "preferences.days_off" | "preferences.long_run_days" | "primary_sports", v: any) => {
    if (path === "primary_sports") { setLocal(prev => ({ ...prev, primary_sports: v })); return; }
    const p = prevPrefs(local);
    const next = { ...local, preferences: p };
    if (path.endsWith("days_off")) next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days")) next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const upsertRunTargets = (patch: Partial<NonNullable<CoachPrefs["targets"]>["run"]>) =>
    setLocal(prev => ({
      ...prev,
      targets: {
        run: {
          race_goal: prev.targets?.run?.race_goal ?? null,
          current_best_time: prev.targets?.run?.current_best_time ?? null,
          target_time: prev.targets?.run?.target_time ?? null,
          longest_recent_distance_km: prev.targets?.run?.longest_recent_distance_km ?? null,
          ...patch,
        },
        ride: prev.targets?.ride ?? { focus: "endurance", weekly_time_target_min: null },
        strength: prev.targets?.strength ?? { focus: "general", sessions_per_week: 2 },
      },
    }));

  const onSave = async () => {
    if (!userId) return;
    try {
      await saveCoachPrefs(userId, local);   // uloží do DB a do LS
      toast.success("Preferences saved");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const onRefresh = async () => {
    if (!userId) return;
    try {
      const fresh = await refreshCoachPrefsFromDB(userId);
      setLocal(fresh);
      toast.success("Refreshed");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const pref = prevPrefs(local);
  const [showAdv, setShowAdv] = useState(false);

  /* lokálny draft pre „pridať externú aktivitu“ */
  const [extDraft, setExtDraft] = useState<ExternalActivity>({
    day: "Tue", sport: "football", intensity: "high", note: ""
  });

  /* lokálny draft pre zranenie */
  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot", type: "overuse", note: "bolesť nártov po dlhých behoch"
  });

  const addExternal = () => {
    const cur = local.external_activities ?? [];
    setLocal(p => ({ ...p, external_activities: [...cur, { ...extDraft, note: extDraft.note?.trim() || undefined }] }));
  };
  const removeExternal = (idx: number) => {
    const cur = local.external_activities ?? [];
    setLocal(p => ({ ...p, external_activities: cur.filter((_, i) => i !== idx) }));
  };

  const addInjury = () => {
    const cur = local.injuries ?? [];
    setLocal(p => ({ ...p, injuries: [...cur, { ...injDraft, note: injDraft.note?.trim() || undefined }] }));
  };
  const removeInjury = (idx: number) => {
    const cur = local.injuries ?? [];
    setLocal(p => ({ ...p, injuries: cur.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-4">
      {/* ========== ZÁKLADNÉ ========== */}
      {/* Goal */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex flex-wrap gap-2">
          {ALL_GOALS.map(g => (
            <button
              key={g}
              onClick={() => setPref("goal_kind", g)}
              className={[
                "px-3 py-1.5 rounded text-sm border",
                local.goal_kind === g ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="weeks (e.g. 8, 10, 12)"
            inputMode="numeric"
            value={local.weeks ?? ""}
            onChange={(e) => setPref("weeks", e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="current best (hh:mm:ss)"
            value={local.targets?.run.current_best_time ?? ""}
            onChange={(e) => upsertRunTargets({ current_best_time: e.target.value || null })}
          />
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="target time (hh:mm:ss)"
            value={local.targets?.run.target_time ?? ""}
            onChange={(e) => upsertRunTargets({ target_time: e.target.value || null })}
          />
        </div>
      </div>

      {/* Sports */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Sports</div>
        <div className="flex flex-wrap gap-2">
          {ALL_SPORTS.map(s => {
            const cur = local.primary_sports ?? local.sports ?? [];
            const next = toggleInArray(cur, s);
            const active = cur.includes(s);
            return (
              <button
                key={s}
                onClick={() => setPrefNested("primary_sports", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Days off */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Days off</div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const next = toggleInArray(pref.days_off, d);
            const active = pref.days_off?.includes(d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.days_off", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Long run days */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Preferred long-run days</div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const next = toggleInArray(pref.long_run_days ?? [], d);
            const active = pref.long_run_days?.includes(d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.long_run_days", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Switches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.avoid_back_to_back_hard}
            onChange={(e) => setLocal(prev => ({
              ...prev,
              preferences: { ...prevPrefs(prev), avoid_back_to_back_hard: e.target.checked },
            }))}
          />
          Avoid two hard days in a row
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.use_zones}
            onChange={(e) => setLocal(prev => ({
              ...prev,
              preferences: { ...prevPrefs(prev), use_zones: e.target.checked },
            }))}
          />
          Use zones
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.wu_cd_detail}
            onChange={(e) => setLocal(prev => ({
              ...prev,
              preferences: { ...prevPrefs(prev), wu_cd_detail: e.target.checked },
            }))}
          />
          Include WU/CD details
        </label>
      </div>

      {/* ===== Pokročilé – collapsible ===== */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowAdv(s => !s)}
          className="px-3 py-1.5 rounded text-sm border bg-white/5 border-white/10 hover:bg-white/10"
          aria-expanded={showAdv}
        >
          {showAdv ? "Hide advanced preferences" : "Show advanced preferences"}
        </button>

        {showAdv && (
          <div className="mt-3 space-y-5">
            {/* Model & špecifické tréningy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!local.vo2max_training}
                  onChange={(e) => setPref("vo2max_training", e.target.checked)}
                />
                Include VO₂max blocks (run)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!local.ftp_training}
                  onChange={(e) => setPref("ftp_training", e.target.checked)}
                />
                Include FTP blocks (ride)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!local.threshold_focus}
                  onChange={(e) => setPref("threshold_focus", e.target.checked)}
                />
                Threshold focus (more Z3/Z4)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  local.polarized_model ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
                onClick={() => setPref("polarized_model", true)}
              >
                Polarized (80/20)
              </button>
              <button
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  local.pyramidal_model ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
                onClick={() => setPref("pyramidal_model", true)}
              >
                Pyramidal
              </button>
              <button
                className="px-3 py-1.5 rounded text-sm border bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => setLocal(p => ({ ...p, polarized_model: false, pyramidal_model: false }))}
              >
                Clear model
              </button>
            </div>

            {/* Externé aktivity (mimo trénera) */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-90">External activities (non-coach)</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  value={extDraft.day}
                  onChange={(e) => setExtDraft(d => ({ ...d, day: e.target.value as DayAbbrev }))}
                >
                  {ALL_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  value={extDraft.sport}
                  onChange={(e) => setExtDraft(d => ({ ...d, sport: e.target.value as ExternalSport }))}
                >
                  {EXT_SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  value={extDraft.intensity}
                  onChange={(e) => setExtDraft(d => ({ ...d, intensity: e.target.value as any }))}
                >
                  {EXT_INTENS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  placeholder="note (optional)"
                  value={extDraft.note ?? ""}
                  onChange={(e) => setExtDraft(d => ({ ...d, note: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addExternal} className="px-3 py-1.5 rounded text-sm border bg-emerald-600 border-emerald-600">
                  Add external
                </button>
              </div>
              {(local.external_activities ?? []).length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {(local.external_activities ?? []).map((a, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-1.5">
                      <span>{a.day} · {a.sport} · {a.intensity}{a.note ? ` — ${a.note}` : ""}</span>
                      <button className="text-rose-400 hover:underline" onClick={() => removeExternal(idx)}>remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Zranenia / obmedzenia */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-90">Injuries / limitations</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  value={injDraft.area}
                  onChange={(e) => setInjDraft(d => ({ ...d, area: e.target.value as any }))}
                >
                  {INJ_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  value={injDraft.type}
                  onChange={(e) => setInjDraft(d => ({ ...d, type: e.target.value as any }))}
                >
                  {INJ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm sm:col-span-2"
                  placeholder="note (e.g., bolesť nártov po dlhých behoch)"
                  value={injDraft.note ?? ""}
                  onChange={(e) => setInjDraft(d => ({ ...d, note: e.target.value }))}
                />
              </div>
              <button onClick={addInjury} className="mt-1 px-3 py-1.5 rounded text-sm border bg-emerald-600 border-emerald-600">
                Add injury
              </button>

              {(local.injuries ?? []).length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {(local.injuries ?? []).map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-1.5">
                      <span>{it.area} · {it.type}{it.note ? ` — ${it.note}` : ""}</span>
                      <button className="text-rose-400 hover:underline" onClick={() => removeInjury(idx)}>remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Focus areas */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-90">Focus areas</div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_CHOICES.map(k => {
                  const active = (local.focus_areas ?? []).includes(k);
                  const next = toggleInArray(local.focus_areas, k);
                  return (
                    <button
                      key={k}
                      onClick={() => setPref("focus_areas", next)}
                      className={[
                        "px-3 py-1.5 rounded text-sm border",
                        active ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                      ].join(" ")}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Avoid zones */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-90">Avoid</div>
              <div className="flex flex-wrap gap-2">
                {AVOID_CHOICES.map(k => {
                  const active = (local.avoid_zones ?? []).includes(k);
                  const next = toggleInArray(local.avoid_zones, k);
                  return (
                    <button
                      key={k}
                      onClick={() => setPref("avoid_zones", next)}
                      className={[
                        "px-3 py-1.5 rounded text-sm border",
                        active ? "bg-emerald-600 border-emerald-600" : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                      ].join(" ")}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rehab / recovery */}
            <div className="space-y-2">
              <div className="text-sm font-medium opacity-90">Rehab & recovery</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!local.rehab_focus?.stretching}
                    onChange={(e) => setPref("rehab_focus", {
                      stretching: e.target.checked,
                      mobility: !!local.rehab_focus?.mobility,
                      balance: !!local.rehab_focus?.balance,
                      recovery_protocol: local.rehab_focus?.recovery_protocol ?? null
                    })}
                  />
                  Stretching
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!local.rehab_focus?.mobility}
                    onChange={(e) => setPref("rehab_focus", {
                      stretching: !!local.rehab_focus?.stretching,
                      mobility: e.target.checked,
                      balance: !!local.rehab_focus?.balance,
                      recovery_protocol: local.rehab_focus?.recovery_protocol ?? null
                    })}
                  />
                  Mobility
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!local.rehab_focus?.balance}
                    onChange={(e) => setPref("rehab_focus", {
                      stretching: !!local.rehab_focus?.stretching,
                      mobility: !!local.rehab_focus?.mobility,
                      balance: e.target.checked,
                      recovery_protocol: local.rehab_focus?.recovery_protocol ?? null
                    })}
                  />
                  Balance/Proprioception
                </label>
                <input
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  placeholder="protocol key (optional)"
                  value={local.rehab_focus?.recovery_protocol ?? ""}
                  onChange={(e) => setPref("rehab_focus", {
                    stretching: !!local.rehab_focus?.stretching,
                    mobility: !!local.rehab_focus?.mobility,
                    balance: !!local.rehab_focus?.balance,
                    recovery_protocol: e.target.value || null
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm">
          Save
        </button>
        <button onClick={onRefresh} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm">
          Refresh
        </button>
      </div>
    </div>
  );
}