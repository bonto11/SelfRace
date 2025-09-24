// src/features/coach/components/PersonalBestsPanel.tsx
// Panel pre Personal Bests (RUN by default):
//  - jednoriadkový formulár (Distance, Time, Activity ID?, Date?)
//  - tabuľka rekordov s "Edit" a dvojkrokovým "Delete"
//  - číta/ukladá cez shared/api/bests (distanceOptions, distanceLabel, getBests, saveBest, deleteBest)

"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import useInfoMessage from "@/shared/hooks/useInfoMessage";

import {
  distanceOptions,
  distanceLabel,
  getBests,
  saveBest,
  deleteBest,
  type UserBest,
  type Sport,
} from "@/shared/api/bests";
import { maskHHMMSS, hhmmssToSec, secToHHMMSS } from "@/shared/utils/time";

type Props = {
  value?: UserBest[];
  onChange?: (v: UserBest[]) => void;
  sport?: Sport; // default "run"
};

type Form = {
  distance_m: string;
  time_str: string;
  activity_id: string;
  achieved_at: string;
};

const EMPTY_FORM: Form = {
  distance_m: "",
  time_str: "",
  activity_id: "",
  achieved_at: "",
};

export default function PersonalBestsPanel({ value, onChange, sport = "run" }: Props) {
  const { userId } = useUserId();
  // ⬇️ tvoj hook vracia { push, success, error } (bez "info")
  const { push, success, error } = useInfoMessage();

  // ----- data
  const [rows, setRows] = useState<UserBest[]>(value ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => setRows(value ?? []), [value]);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const arr = await getBests(userId, sport);
      setRows(arr);
      onChange?.(arr);
    } catch (e: any) {
      error(`PB load failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && (!value || value.length === 0)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sport]);

  // ----- formulár
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const setF = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const canSave = useMemo(
    () => !!form.distance_m && !!form.time_str.trim() && !saving,
    [form.distance_m, form.time_str, saving]
  );

  const handleEditClick = (b: UserBest) => {
    setForm({
      distance_m: String(b.distance_m),
      time_str: b.time_str ?? (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
      activity_id: b.activity_id != null ? String(b.activity_id) : "",
      achieved_at: b.achieved_at ?? "",
    });
  };

  const clearForm = () => setForm(EMPTY_FORM);

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const distance_m = Number.parseInt(form.distance_m, 10);
      const sec = hhmmssToSec(form.time_str.trim());

      await saveBest(userId, {
        sport,
        distance_m,
        time_str: Number.isFinite(sec ?? NaN) ? undefined : form.time_str.trim(),
        activity_id: form.activity_id.trim()
          ? Number.parseInt(form.activity_id.trim(), 10)
          : undefined,
        achieved_at: form.achieved_at.trim() || undefined,
        ...(Number.isFinite(sec ?? NaN) ? { time_sec: sec! } : {}),
      } as any);

      success("Personal best saved");
      clearForm();
      await refresh();
    } catch (e: any) {
      error(`Save failed: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  // ----- mazanie (dvojkrokové)
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const askDelete = (m: number) => setPendingDelete(m);
  const cancelDelete = () => setPendingDelete(null);

  const confirmDelete = async (m: number) => {
    if (!userId) return;
    try {
      await deleteBest(userId, m, sport);
      success("Record deleted"); // predtým "info"
      setPendingDelete(null);
      await refresh();
    } catch (e: any) {
      error(`Delete failed: ${e?.message ?? e}`);
    }
  };

  // ----- UI
  return (
    <div className="bg-gray-800 rounded p-3 space-y-3">
      <h3 className="font-semibold">Personal Bests — {sport === "run" ? "Running" : sport}</h3>

      {/* jednoriadkový formulár */}
      <div className="grid grid-cols-[160px_160px_160px_180px_auto] gap-2 items-center">
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          value={form.distance_m}
          onChange={(e) => setF({ distance_m: e.target.value })}
        >
          <option value="">— choose distance —</option>
          {distanceOptions(sport).map((opt) => (
            <option key={opt.m} value={opt.m}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) => setF({ time_str: maskHHMMSS(e.target.value) })}
          inputMode="numeric"
        />

        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          placeholder="Activity ID (optional)"
          value={form.activity_id}
          onChange={(e) => setF({ activity_id: e.target.value })}
          inputMode="numeric"
        />

        <input
          type="date"
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          value={form.achieved_at}
          onChange={(e) => setF({ achieved_at: e.target.value })}
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={clearForm}
            disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
          >
            Clear
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* tabuľka */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left opacity-80">
            <tr>
              <th className="py-2 pr-4">Distance</th>
              <th className="py-2 pr-4">Best time</th>
              <th className="py-2 pr-4">Activity ID</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 opacity-70">
                  No records yet.
                </td>
              </tr>
            ) : (
              rows
                .slice()
                .sort((a, b) => a.distance_m - b.distance_m)
                .map((b) => (
                  <tr key={`${sport}-${b.distance_m}`} className="border-t border-gray-700/60">
                    <td className="py-2 pr-4">{distanceLabel(b.distance_m, sport)}</td>
                    <td className="py-2 pr-4">
                      {b.best_time_s != null ? secToHHMMSS(b.best_time_s) : b.time_str ?? "—"}
                    </td>
                    <td className="py-2 pr-4">{b.activity_id ?? "—"}</td>
                    <td className="py-2 pr-4">{b.achieved_at ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {pendingDelete === b.distance_m ? (
                        <div className="flex gap-2">
                          <button
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded"
                            onClick={() => confirmDelete(b.distance_m)}
                          >
                            Confirm
                          </button>
                          <button
                            className="text-xs underline opacity-90 hover:opacity-100"
                            onClick={cancelDelete}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            className="text-xs underline opacity-90 hover:opacity-100"
                            onClick={() => handleEditClick(b)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs underline opacity-90 hover:opacity-100"
                            onClick={() => askDelete(b.distance_m)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}