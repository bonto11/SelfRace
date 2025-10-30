"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import ActivitySelector from "@/shared/components/ActivitySelector";
import type { MiniActivity } from "@/shared/types/activities";
import ActivityDetailOverlay from "@/shared/components/ActivityDetailOverlay";

// ---- Form state -------------------------------------------------------------
export type PBRunFormState = {
  distance_m: string;
  time_str: string;
  achieved_at: string; // YYYY-MM-DD
  activity_id: string; // ""
  activity_name?: string; // optional
};

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: undefined,
};

const isoDateOnly = (s?: string | null) => (s ? s.slice(0, 10) : "");

// ---- Swipe helpers ----------------------------------------------------------
const SNAP_OPEN = -160; // px (80 + 80)
const SNAP_CLOSED = 0;

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun();
  const favoriteM = favM ?? 5000;
  const { success, error } = useInfoMessage();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  // ---- data load
  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await getBests(userId, "run"));
    } catch (e: any) {
      error(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (userId) refresh(); /* eslint-disable-next-line */
  }, [userId]);

  // ---- form guards
  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    return Number.isFinite(m) && m > 0 && !!form.time_str.trim() && !saving;
  }, [form.distance_m, form.time_str, saving]);

  // ---- save / delete
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
        activity_name: form.activity_name?.trim() || undefined, // ⬅️ new
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

  // ---- UI
  return (
    <div className="space-y-4">
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM */}
      <div className="grid gap-2 sm:grid-cols-12 items-start">
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

        {/* Date with overlay so it never overflows */}
        <div className="relative sm:col-span-2 w-full max-w-[180px]">
          <div className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-center select-none truncate">
            {form.achieved_at
              ? form.achieved_at.replaceAll("-", ".")
              : "YYYY-MM-DD"}
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

        {/* Activity selector */}
        <div className="sm:col-span-4">
          <ActivitySelector
            userId={userId ?? null}
            dateIso={form.achieved_at}
            sports={["run", "mixed"]}
            value={form.activity_id ? Number(form.activity_id) : ""}
            onChange={(v) =>
              setForm((f) => ({ ...f, activity_id: v === "" ? "" : String(v) }))
            }
            onPicked={(a: MiniActivity | null) =>
              setForm((f) => ({ ...f, activity_name: a?.name ?? undefined }))
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

      {/* LIST (cards) + 2-polohový swipe */}
      <ul className="space-y-2">
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => (
            <SwipeRow
              key={b.distance_m}
              onEdit={() => {
                setForm({
                  distance_m: String(b.distance_m),
                  time_str:
                    b.time_str ??
                    (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
                  activity_id:
                    b.activity_id != null ? String(b.activity_id) : "",
                  activity_name: (b as any).activity_name ?? undefined,
                  achieved_at: isoDateOnly(b.achieved_at), // ⬅️ normalizácia na YYYY-MM-DD
                });
              }}
              onDelete={() => setPendingDelete(b.distance_m)}
            >
              <div className="flex items-start justify-between gap-3">
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
                    {b.best_time_s != null
                      ? secToHHMMSS(b.best_time_s)
                      : b.time_str ?? "—"}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {isoDateOnly(b.achieved_at)}
                    {(b as any).activity_name ? (
                      <>
                        {" · "}
                        <button
                          className="underline hover:opacity-100 opacity-90"
                          onClick={() => {
                            // ak máme aj activity_id, otvoríme overlay; ak nie, len nič
                            if (b.activity_id != null)
                              setDetailId(Number(b.activity_id));
                          }}
                          disabled={b.activity_id == null}
                        >
                          {(b as any).activity_name}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </SwipeRow>
          ))}
        {rows.length === 0 && (
          <li className="text-sm opacity-70">No records yet.</li>
        )}
      </ul>

      {/* delete confirm inline (kept simple) */}
      {pendingDelete !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded p-4 space-y-3 w-[92%] max-w-sm">
            <div className="font-semibold">Delete this record?</div>
            <div className="text-sm opacity-80">
              This action cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 rounded bg-gray-700"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-red-600"
                onClick={() => confirmDelete(pendingDelete!)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId != null && (
        <ActivityDetailOverlay
          activityId={detailId}
          open={true}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

// ---- SwipeRow: 2-polohové, full-height actions ------------------------------
function SwipeRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tx, setTx] = useState(0);
  const startX = useRef<number | null>(null);

  const commit = () =>
    setTx(Math.abs(tx) > Math.abs(SNAP_OPEN) / 2 ? SNAP_OPEN : SNAP_CLOSED);

  return (
    <li
      className="relative bg-gray-800 rounded border border-gray-700/60 overflow-hidden touch-pan-x"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchMove={(e) => {
        if (startX.current == null) return;
        const dx = e.touches[0].clientX - startX.current;
        // len doľava
        setTx(
          Math.max(-200, Math.min(0, dx + (tx === SNAP_OPEN ? SNAP_OPEN : 0)))
        );
      }}
      onTouchEnd={() => {
        startX.current = null;
        commit();
      }}
    >
      {/* actions */}
      <div className="absolute inset-y-0 right-0 flex w-[160px]">
        <button
          className="w-1/2 h-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
          onClick={() => {
            setTx(SNAP_CLOSED);
            onEdit();
          }}
        >
          Edit
        </button>
        <button
          className="w-1/2 h-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
          onClick={() => onDelete()}
        >
          Delete
        </button>
      </div>

      {/* content */}
      <div
        className="relative px-3 py-2"
        style={{
          transform: `translateX(${tx}px)`,
          transition: "transform 160ms ease-out",
        }}
      >
        {children}
      </div>
    </li>
  );
}
