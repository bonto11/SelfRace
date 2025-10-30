"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  distanceOptions,
  distanceLabel,
  getBests,
  saveBest,
  deleteBest,
  type UserBest,
} from "@/shared/api/bests";
import { secToHHMMSS, maskHHMMSS, hhmmssToSec } from "@/shared/utils/time";
import useInfoMessage from "@/shared/hooks/useInfoMessage";
import { useFavoritePBRun } from "@/features/coach/hooks/useFavoritePBRun";

type Form = {
  distance_m: string;
  time_str: string;
  activity_id: string;
  achieved_at: string;
};
const EMPTY: Form = {
  distance_m: "",
  time_str: "",
  activity_id: "",
  achieved_at: "",
};

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun();
  const favoriteM = favM ?? 5000;

  const { success, error } = useInfoMessage();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getBests(userId, "run");
      setRows(data);
    } catch (e: any) {
      error(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    return Number.isFinite(m) && m > 0 && !!form.time_str.trim() && !saving;
  }, [form.distance_m, form.time_str, saving]);

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const m = Number(form.distance_m);
      const sec = hhmmssToSec(form.time_str.trim());

      await saveBest(userId, {
        sport: "run",
        distance_m: m,
        time_str: Number.isFinite(sec ?? NaN)
          ? undefined
          : form.time_str.trim(),
        ...(Number.isFinite(sec ?? NaN) ? { time_sec: sec! } : {}),
        activity_id: form.activity_id.trim()
          ? Number(form.activity_id)
          : undefined,
        achieved_at: form.achieved_at || undefined,
      } as any);

      success("Personal best saved");
      setForm(EMPTY);
      await refresh();
    } catch (e: any) {
      error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (m: number) => {
    if (!userId) return;
    try {
      await deleteBest(userId, m, "run");
      success("Record deleted");
      await refresh();
    } catch (e: any) {
      error(String(e?.message ?? e));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* hviezdička – obľúbená vzdialenosť */}
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* formulár (stack na mobile, grid na >=sm) */}
      <div className="grid grid-cols-1 sm:[grid-template-columns:160px_160px_160px_180px_auto] gap-2 items-center">
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
          value={form.distance_m}
          onChange={(e) =>
            setForm((f) => ({ ...f, distance_m: e.target.value }))
          }
        >
          <option value="">— choose distance —</option>
          {distanceOptions("run").map((o) => (
            <option key={o.m} value={o.m}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) =>
            setForm((f) => ({ ...f, time_str: maskHHMMSS(e.target.value) }))
          }
          inputMode="numeric"
        />

        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
          placeholder="Activity ID (optional)"
          value={form.activity_id}
          onChange={(e) =>
            setForm((f) => ({ ...f, activity_id: e.target.value }))
          }
          inputMode="numeric"
        />

        <input
          type="date"
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
          value={form.achieved_at}
          onChange={(e) =>
            setForm((f) => ({ ...f, achieved_at: e.target.value }))
          }
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
            onClick={() => setForm(EMPTY)}
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
      {/* tabuľka – edge-to-edge scroll na mobile, bez pretekania */}
      <div className="relative max-w-full overflow-hidden">
        {/* -mx-3 zruší vnútorný padding rodiča, aby sa scrollovací obsah
      dotýkal okraja obrazovky a nepretekal vizuálne */}
        <div className="-mx-3 sm:mx-0">
          <div className="overflow-x-auto px-3 sm:px-0">
            <table className="table-fixed w-[720px] sm:w-full">
              {/* pevné šírky stĺpcov – drží layout pokope aj pri dlhších hodnotách */}
              <colgroup>
                <col style={{ width: "40px" }} /> {/* ★ */}
                <col style={{ width: "140px" }} /> {/* Distance */}
                <col style={{ width: "140px" }} /> {/* Best time */}
                <col style={{ width: "130px" }} /> {/* Activity ID */}
                <col style={{ width: "160px" }} /> {/* Date */}
                <col style={{ width: "110px" }} /> {/* Actions */}
              </colgroup>

              <thead className="text-left opacity-80">
                <tr>
                  <th className="py-2 pr-3">★</th>
                  <th className="py-2 pr-3">Distance</th>
                  <th className="py-2 pr-3">Best time</th>
                  <th className="py-2 pr-3">Activity ID</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 opacity-70">
                      No records yet.
                    </td>
                  </tr>
                ) : (
                  rows
                    .slice()
                    .sort((a, b) => a.distance_m - b.distance_m)
                    .map((b) => {
                      const fmtDate = (d?: string | null) => {
                        if (!d) return "—";
                        const only = d.split("T")[0]; // „2025-02-27“
                        return only || d;
                      };
                      return (
                        <tr
                          key={b.distance_m}
                          className="border-t border-gray-700/60"
                        >
                          <td className="py-2 pr-3">
                            <button
                              aria-label="Set as favorite"
                              onClick={() => setFavM(b.distance_m)}
                              className={`text-lg leading-none ${
                                favoriteM === b.distance_m
                                  ? "text-yellow-400"
                                  : "text-gray-500 hover:text-gray-300"
                              }`}
                            >
                              ★
                            </button>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {distanceLabel(b.distance_m, "run")}
                          </td>
                          <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                            {b.best_time_s != null
                              ? secToHHMMSS(b.best_time_s)
                              : b.time_str ?? "—"}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {b.activity_id ?? "—"}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {fmtDate(b.achieved_at)}
                          </td>
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
                                  onClick={() => setPendingDelete(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-3">
                                <button
                                  className="text-xs underline opacity-90 hover:opacity-100"
                                  onClick={() =>
                                    setForm({
                                      distance_m: String(b.distance_m),
                                      time_str:
                                        b.time_str ??
                                        (b.best_time_s
                                          ? secToHHMMSS(b.best_time_s)
                                          : ""),
                                      activity_id:
                                        b.activity_id != null
                                          ? String(b.activity_id)
                                          : "",
                                      achieved_at: b.achieved_at ?? "",
                                    })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  className="text-xs underline opacity-90 hover:opacity-100"
                                  onClick={() => setPendingDelete(b.distance_m)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
