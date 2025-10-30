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

    {/* formulár (stack na mobile, grid až od sm) */}
    <div className="grid grid-cols-1 sm:[grid-template-columns:160px_160px_160px_180px_auto] gap-2 items-center max-w-full">
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
        value={form.distance_m}
        onChange={(e) => setForm((f) => ({ ...f, distance_m: e.target.value }))}
      >
        <option value="">— choose distance —</option>
        {distanceOptions("run").map((o) => (
          <option key={o.m} value={o.m}>{o.label}</option>
        ))}
      </select>

      <input
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
        placeholder="hh:mm:ss"
        value={form.time_str}
        onChange={(e) => setForm((f) => ({ ...f, time_str: maskHHMMSS(e.target.value) }))}
        inputMode="numeric"
      />

      <input
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
        placeholder="Activity ID (optional)"
        value={form.activity_id}
        onChange={(e) => setForm((f) => ({ ...f, activity_id: e.target.value }))}
        inputMode="numeric"
      />

      <input
        type="date"
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full"
        value={form.achieved_at}
        onChange={(e) => setForm((f) => ({ ...f, achieved_at: e.target.value }))}
      />

      <div className="flex gap-2 w-full sm:w-auto">
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

    {/* TABUĽKA – scrolluje SA IBA VNÚTRI, stránka nikdy nepretečie */}
    
    
  </div>
);
}
