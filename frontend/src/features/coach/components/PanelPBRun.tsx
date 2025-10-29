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
} from "@/shared/api/bests";
import { maskHHMMSS, hhmmssToSec, secToHHMMSS } from "@/shared/utils/time";
import type { PBRun } from "@/features/coach/types/prefsTypes";

// ---- adapters ----------------------------------------------------------------
const mToKm = (m: number) => +(m / 1000).toFixed(1);

function toPBRun(b: UserBest): PBRun {
  return {
    distanceKm: mToKm(b.distance_m),
    best: b.time_str ?? (b.best_time_s != null ? secToHHMMSS(b.best_time_s) ?? "" : ""),
    activityId: b.activity_id ?? null,
    date: b.achieved_at ?? null,
  };
}

type Props = {
  value?: PBRun[];                    // preferovaný typ von
  onChange?: (v: PBRun[]) => void;    // callback vo formáte PBRun[]
};

type Form = {
  distance_m: string;
  time_str: string;
  activity_id: string;
  achieved_at: string;
};

const EMPTY_FORM: Form = { distance_m: "", time_str: "", activity_id: "", achieved_at: "" };

export default function PanelPBRun({ value, onChange }: Props) {
  const { userId } = useUserId();
  const { success, error } = useInfoMessage();

  // interné držím `UserBest[]` (priamo sedí na API)
  const [rows, setRows] = useState<UserBest[]>([]);
  const [loading, setLoading] = useState(false);

  // ak prišlo PBRun zvonka, premosť na UserBest len pre zobrazenie
  useEffect(() => {
    if (!value?.length) return;
    setRows(
      value.map((p) => ({
        distance_m: Math.round(p.distanceKm * 1000),
        best_time_s: hhmmssToSec(p.best) ?? undefined,
        time_str: hhmmssToSec(p.best) == null ? p.best : undefined,
        activity_id: p.activityId ?? null,
        achieved_at: p.date ?? null,
      }))
    );
  }, [value]);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const arr = await getBests(userId, "run");
      setRows(arr);
      onChange?.(arr.map(toPBRun));
    } catch (e: any) {
      error(`PB load failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && !value) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
        sport: "run",
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
      await deleteBest(userId, m, "run");
      success("Record deleted");
      setPendingDelete(null);
      await refresh();
    } catch (e: any) {
      error(`Delete failed: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="bg-gray-800 rounded p-3 space-y-3">
      <h3 className="font-semibold">Personal Bests — Running</h3>

      {/* Form */}
      <div className="grid grid-cols-[160px_160px_160px_180px_auto] gap-2 items-center">
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          value={form.distance_m}
          onChange={(e) => setF({ distance_m: e.target.value })}
        >
          <option value="">— choose distance —</option>
          {distanceOptions("run").map((opt) => (
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

      {/* Table */}
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
                <td colSpan={5} className="py-3 opacity-70">No records yet.</td>
              </tr>
            ) : (
              rows
                .slice()
                .sort((a, b) => a.distance_m - b.distance_m)
                .map((b) => (
                  <tr key={`run-${b.distance_m}`} className="border-t border-gray-700/60">
                    <td className="py-2 pr-4">{distanceLabel(b.distance_m, "run")}</td>
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