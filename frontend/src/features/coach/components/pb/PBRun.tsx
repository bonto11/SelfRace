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
    if (userId) refresh(); /* eslint-disable-next-line */
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

  const fmtDate = (d?: string | null) => d?.split("T")[0] ?? "—";

  return (
    <div className="space-y-4">
      {/* hviezdička – obľúbená vzdialenosť */}
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM – responsive 2-row grid (no overflow) */}
      <div className="grid gap-2 sm:grid-cols-12 items-start">
        {/* 1. riadok (sm a vyššie): distance · time · date · (voľno) · (voľno) */}
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
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
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) =>
            setForm((f) => ({ ...f, time_str: maskHHMMSS(e.target.value) }))
          }
          inputMode="numeric"
        />

        <input
          type="date"
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-2 sm:max-w-[40px]"
          value={form.achieved_at}
          onChange={(e) =>
            setForm((f) => ({ ...f, achieved_at: e.target.value }))
          }
        />

        {/* 2. riadok: activityId + buttons (wrap na úzkych displejoch) */}
        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-4"
          placeholder="Activity ID (optional)"
          value={form.activity_id}
          onChange={(e) =>
            setForm((f) => ({ ...f, activity_id: e.target.value }))
          }
          inputMode="numeric"
        />

        <div className="flex flex-wrap gap-2 sm:justify-end sm:col-span-8">
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

      {/* LIST – karty ako Activity, nič nepretečie */}
      <ul className="space-y-2">
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => {
            const time =
              b.best_time_s != null
                ? secToHHMMSS(b.best_time_s)
                : b.time_str ?? "—";
            return (
              <li
                key={b.distance_m}
                className="bg-gray-800 rounded px-3 py-2 border border-gray-700/60"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* left info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        aria-label="Set as favorite"
                        onClick={() => setFavM(b.distance_m)}
                        className={`text-lg leading-none shrink-0 ${
                          favoriteM === b.distance_m
                            ? "text-yellow-400"
                            : "text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                      <div className="text-sm font-medium truncate">
                        {distanceLabel(b.distance_m, "run")}
                      </div>
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tabular-nums leading-none">
                      {time}
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      {fmtDate(b.achieved_at)}
                    </div>
                  </div>

                  {/* right actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
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
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        {rows.length === 0 && (
          <li className="text-sm opacity-70">No records yet.</li>
        )}
      </ul>
    </div>
  );
}
