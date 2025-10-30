"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  distanceOptions, distanceLabel,
  getBests, saveBest, deleteBest,
  type UserBest
} from "@/shared/api/bests";
import { secToHHMMSS, maskHHMMSS, hhmmssToSec } from "@/shared/utils/time";
import useInfoMessage from "@/shared/hooks/useInfoMessage";
import { useFavoritePBRun } from "@/features/coach/hooks/useFavoritePBRun";
import ActivitySelector from "@/shared/components/ActivitySelector";
import type { MiniActivity } from "@/shared/types/activities";

// --- presný názov stavu formulára
export type PBRunFormState = {
  distance_m: string;     // "1000" | "5000" | ...
  time_str: string;       // "hh:mm:ss"
  achieved_at: string;    // "YYYY-MM-DD"
  activity_id: string;    // "" alebo číslo v texte
  activity_name?: string; // optional, ukladáme ak je
};

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: "",
};

// pekný text v inpute nad natívnym date pickerom
function prettyDate(d: string) {
  return d ? d.replaceAll("-", ".") : "YYYY-MM-DD";
}
const onlyDate = (d?: string | null) => d?.split("T")[0] ?? "—";

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun();
  const favoriteM = favM ?? 5000;
  const { success, error } = useInfoMessage();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // swipe state: ktorý m je „otvorený“
  const [openSwipe, setOpenSwipe] = useState<number | null>(null);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try { setRows(await getBests(userId, "run")); }
    catch (e: any) { error(String(e?.message ?? e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userId) refresh(); /* eslint-disable-next-line */ }, [userId]);

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
        activity_id: form.activity_id.trim() ? Number(form.activity_id) : undefined,
        activity_name: form.activity_name?.trim() || undefined, // BE môže ignorovať, ak nepodporuje
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

  const askEdit = (b: UserBest) => {
    setForm({
      distance_m: String(b.distance_m),
      time_str: b.time_str ?? (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
      activity_id: b.activity_id != null ? String(b.activity_id) : "",
      activity_name: (b as any).activity_name ?? "",
      achieved_at: b.achieved_at ?? "",
    });
  };

  const confirmDelete = async (m: number) => {
    if (!userId) return;
    try { await deleteBest(userId, m, "run"); success("Record deleted"); await refresh(); }
    catch (e: any) { error(String(e?.message ?? e)); }
    finally { setOpenSwipe(null); }
  };

  // --- SWIPE helpers (mobil)
  function SwipeRow({
    m, children, onEdit, onDelete,
  }: { m:number; children: React.ReactNode; onEdit: () => void; onDelete: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const curX = useRef(0);
    const [tx, setTx] = useState(0);
    const opened = openSwipe === m;
    useEffect(() => { setTx(opened ? -96 : 0); }, [opened]);

    const onStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
    const onMove  = (e: React.TouchEvent) => {
      curX.current = e.touches[0].clientX;
      const dx = Math.min(0, curX.current - startX.current);
      setTx(Math.max(-120, dx));
    };
    const onEnd = () => {
      const dx = curX.current - startX.current;
      if (dx < -60) setOpenSwipe(m);
      else setOpenSwipe(null);
    };

    return (
      <div className="relative">
        {/* actions layer */}
        <div className="absolute inset-y-0 right-0 flex gap-2 items-center pr-2">
          <button
            className="px-3 py-1.5 rounded text-sm bg-amber-600 hover:bg-amber-700"
            onClick={() => { setOpenSwipe(null); onEdit(); }}
          >
            Edit
          </button>
          <button
            className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-700"
            onClick={() => {
              if (confirm("Naozaj vymazať tento rekord?")) onDelete();
            }}
          >
            Delete
          </button>
        </div>

        {/* content layer */}
        <div
          ref={ref}
          className="bg-gray-800 rounded px-3 py-2 border border-gray-700/60 touch-pan-y"
          style={{ transform: `translateX(${tx}px)`, transition: "transform 140ms ease" }}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
          onTouchCancel={() => setOpenSwipe(null)}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* info o obľúbenej vzdialenosti */}
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM */}
      <div className="grid gap-2 sm:grid-cols-12 items-start">
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
          value={form.distance_m}
          onChange={(e) => setForm(f => ({ ...f, distance_m: e.target.value }))}
        >
          <option value="">— choose distance —</option>
          {distanceOptions("run").map(o => <option key={o.m} value={o.m}>{o.label}</option>)}
        </select>

        <input
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full sm:col-span-3"
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) => setForm(f => ({ ...f, time_str: maskHHMMSS(e.target.value) }))}
          inputMode="numeric"
        />

        {/* pekný natívny date (overlay label) */}
        <div className="relative sm:col-span-2 w-full sm:max-w-[180px]">
          <div className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-center select-none truncate">
            {prettyDate(form.achieved_at)}
          </div>
          <input
            type="date"
            className="absolute inset-0 opacity-0 w-full h-full"
            value={form.achieved_at}
            onChange={(e) => setForm(f => ({ ...f, achieved_at: e.target.value }))}
            aria-label="Pick date"
          />
        </div>

        {/* Activity selector: vracia id aj názov */}
        <div className="sm:col-span-4">
          <ActivitySelector
            userId={userId ?? null}
            dateIso={form.achieved_at}
            sports={["run","mixed"]}
            value={form.activity_id ? Number(form.activity_id) : ""}
            onChange={(id) => setForm(f => ({ ...f, activity_id: id === "" ? "" : String(id) }))}
            onPickActivity={(a: MiniActivity | null) =>
              setForm(f => ({ ...f,
                activity_id: a ? String(a.id) : "",
                activity_name: a?.name || ""
              }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end sm:col-span-12">
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

      {/* LIST – swipeable karty */}
      <ul className="space-y-2">
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => {
            const time = b.best_time_s != null ? secToHHMMSS(b.best_time_s) : b.time_str ?? "—";
            const aname = (b as any).activity_name as string | undefined;
            return (
              <li key={b.distance_m}>
                <SwipeRow
                  m={b.distance_m}
                  onEdit={() => askEdit(b)}
                  onDelete={() => confirmDelete(b.distance_m)}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* left */}
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
                        {onlyDate(b.achieved_at)}
                        {aname ? <> — <span className="opacity-90">{aname}</span></> : null}
                      </div>
                    </div>
                  </div>
                </SwipeRow>
              </li>
            );
          })}
        {rows.length === 0 && <li className="text-sm opacity-70">No records yet.</li>}
      </ul>
    </div>
  );
}