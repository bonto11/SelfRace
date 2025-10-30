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
import ActivitySelector, { type ActivityChoice } from "@/shared/components/ActivitySelector";

// Presný názov stavu formulára (môžeš presunúť do shared/types/pb.ts)
export type PBRunFormState = {
  distance_m: string;     // "1000" | "5000" | ...
  time_str: string;       // "hh:mm:ss"
  achieved_at: string;    // "YYYY-MM-DD"
  activity_id: string;    // "" alebo číslo v texte
  activity_name: string;  // label vybranej aktivity (môže byť "")
};

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: "",
};

const isoDateOnly = (d?: string | null) => (d ? d.slice(0, 10) : "");

/** zobrazí pekne YYYY.MM.DD (len vizuálne v “fake” inpute) */
function prettyDate(d: string) {
  return d ? d.replaceAll("-", ".") : "YYYY-MM-DD";
}

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun();
  const favoriteM = favM ?? 5000;
  const { success, error } = useInfoMessage();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [picked, setPicked] = useState<ActivityChoice>({ id: "", name: "" });
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
        time_str: Number.isFinite(sec ?? NaN) ? undefined : form.time_str.trim(),
        ...(Number.isFinite(sec ?? NaN) ? { time_sec: sec! } : {}),
        achieved_at: form.achieved_at || undefined,
        activity_id: form.activity_id ? Number(form.activity_id) : undefined,
        activity_name: form.activity_name || undefined, // voliteľné, ak BE podporí
      } as any);

      success("Personal best saved");
      setForm(EMPTY);
      setPicked({ id: "", name: "" });
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
    <div className="space-y-4">
      {/* info o obľúbenej vzdialenosti */}
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM – 2 riadky, bez overflow */}
      <div className="grid gap-2 sm:grid-cols-12 items-start">
        {/* distance */}
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
          value={form.distance_m}
          onChange={(e) => setForm((f) => ({ ...f, distance_m: e.target.value }))}
        >
          <option value="">— choose distance —</option>
          {distanceOptions("run").map((o) => (
            <option key={o.m} value={o.m}>{o.label}</option>
          ))}
        </select>

        {/* time */}
        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) => setForm((f) => ({ ...f, time_str: maskHHMMSS(e.target.value) }))}
          inputMode="numeric"
        />

        {/* date – nepretečie; overlay nad natívnym inputom */}
        <div className="relative sm:col-span-2 w-full max-w-[180px]">
          <div className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-center select-none truncate">
            {prettyDate(form.achieved_at)}
          </div>
          <input
            type="date"
            className="absolute inset-0 opacity-0 w-full h-full"
            value={form.achieved_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, achieved_at: e.target.value }))
            }
            aria-label="Pick date"
          />
        </div>

        {/* ActivitySelector */}
        <div className="sm:col-span-4">
          <ActivitySelector
            userId={userId ?? null}
            dateIso={form.achieved_at}
            sports={["run", "mixed"]}
            value={picked}
            onChange={(v) => {
              setPicked(v);
              setForm((f) => ({
                ...f,
                activity_id: v.id === "" ? "" : String(v.id),
                activity_name: v.name ?? "",
              }));
            }}
          />
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2 sm:justify-end sm:col-span-12">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setForm(EMPTY); setPicked({ id: "", name: "" }); }}
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

      {/* LIST – karty (ako Activities) */}
      <ul className="space-y-2">
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => {
            const time = b.best_time_s != null ? secToHHMMSS(b.best_time_s) : b.time_str ?? "—";
            const date = isoDateOnly(b.achieved_at);
            const actName = (b as any).activity_name as string | undefined; // ak BE pridá pole
            return (
              <li key={b.distance_m} className="bg-gray-800 rounded px-3 py-2 border border-gray-700/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        aria-label="Set as favorite"
                        onClick={() => setFavM(b.distance_m)}
                        className={`text-lg leading-none shrink-0 ${favoriteM === b.distance_m ? "text-yellow-400" : "text-gray-500 hover:text-gray-300"}`}
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
                    <div className="mt-1 text-xs opacity-75 truncate">
                      {date || "—"}
                      {actName ? <> · <span className="underline decoration-dotted">{actName}</span></> : null}
                    </div>
                  </div>

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
                          onClick={() => {
                            setForm({
                              distance_m: String(b.distance_m),
                              time_str: b.time_str ?? (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
                              achieved_at: isoDateOnly(b.achieved_at),   // vždy YYYY-MM-DD
                              activity_id: b.activity_id != null ? String(b.activity_id) : "",
                              activity_name: (b as any).activity_name || "",
                            });
                            setPicked(
                              b.activity_id != null
                                ? { id: b.activity_id, name: (b as any).activity_name || "" }
                                : { id: "", name: "" }
                            );
                          }}
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
        {rows.length === 0 && <li className="text-sm opacity-70">No records yet.</li>}
      </ul>
    </div>
  );
}