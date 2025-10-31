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
import { useFavoritePBRun } from "@/shared/hooks/useFavoritePBRun";
import ActivitySelector from "@/shared/components/ActivitySelector";
import ActivityDetailOverlay from "@/shared/components/ActivityDetailOverlay";
import type { MiniActivity } from "@/shared/types/activities";
import { toast } from "@/shared/components/ui/Toast";
import { confirm } from "@/shared/components/ui/Confirm";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import { inputClass } from "@/shared/ui";

/* ----------------------- Form state ----------------------- */
export type PBRunFormState = {
  distance_m: string;
  time_str: string; // hh:mm:ss
  achieved_at: string; // YYYY-MM-DD
  activity_id: string; // "" alebo číslo v texte
  activity_name?: string;
};

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: undefined,
};

const isoDateOnly = (s?: string | null) => (s ? s.slice(0, 10) : "");
const prettyDate = (s?: string) => (s ? s.replaceAll("-", ".") : "YYYY-MM-DD");

/* ----------------------- Swipe consts --------------------- */
const ACTION_W = 160; // 2 tlačidlá po 80 px
const SNAP_OPEN = -ACTION_W;
const SNAP_CLOSED = 0;

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun();
  const favoriteM = favM ?? 5000;

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  /* ---------- load ---------- */
  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await getBests(userId, "run"));
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (userId) refresh(); /* eslint-disable-next-line */
  }, [userId]);

  /* ---------- guards ---------- */
  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    return Number.isFinite(m) && m > 0 && !!form.time_str.trim() && !saving;
  }, [form.distance_m, form.time_str, saving]);

  /* ---------- actions ---------- */
  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const m = Number(form.distance_m);
      const sec = hhmmssToSec(form.time_str.trim());

      const payload: any = {
        sport: "run",
        distance_m: m,
        ...(Number.isFinite(sec)
          ? { time_sec: sec }
          : { time_str: form.time_str.trim() }),
      };

      if (form.activity_id !== "") payload.activity_id = Number(form.activity_id);
      if (form.activity_name !== undefined) payload.activity_name = form.activity_name.trim();
      if (form.achieved_at) payload.achieved_at = form.achieved_at.replace(/\./g, "-");

      await saveBest(userId, payload);
      toast.success("Personal best saved");
      setForm(EMPTY);
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: number) => {
    const ok = await confirm({
      title: "Vymazať rekord?",
      message: `Túto akciu nemožno vrátiť.\n(${distanceLabel(m, "run")})`,
      okText: "Vymazať",
      cancelText: "Zrušiť",
      tone: "danger",
    });
    if (!ok || !userId) return;
    try {
      await deleteBest(userId, m, "run");
      toast.success("Record deleted");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  /* ----------------------- UI ------------------------------ */
  return (
    <div className="space-y-4">
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM */}
      <div className="grid gap-2 sm:grid-cols-12 items-start">
        <select
          className={inputClass + " sm:col-span-3"}
          value={form.distance_m}
          onChange={(e) => setForm((f) => ({ ...f, distance_m: e.target.value }))}
        >
          <option value="">— choose distance —</option>
          {distanceOptions("run").map((o) => (
            <option key={o.m} value={o.m}>
              {o.label}
            </option>
          ))}
        </select>

        <TextField
          label=""
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) =>
            setForm((f) => ({ ...f, time_str: maskHHMMSS((e.target as HTMLInputElement).value) }))
          }
          inputMode="numeric"
          containerClassName="sm:col-span-3"
        />

        {/* Date s overlayom – ostáva tvoj UX, len look */}
        <div className="relative sm:col-span-2 w-full max-w-[180px]">
          <div className={inputClass + " text-center select-none truncate"}>
            {prettyDate(form.achieved_at)}
          </div>
          <input
            type="date"
            className="absolute inset-0 opacity-0 w-full h-full"
            value={form.achieved_at}
            onChange={(e) => setForm((f) => ({ ...f, achieved_at: e.target.value }))}
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
            onChange={(v) => setForm((f) => ({ ...f, activity_id: v === "" ? "" : String(v) }))}
            onPicked={(a: MiniActivity | null) =>
              setForm((f) => ({ ...f, activity_name: a ? a.name : "" }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end sm:col-span-12">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            variant="success"
          >
            {saving ? "Ukladám…" : "Uložiť"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setForm(EMPTY)}
          >
            Clear
          </Button>

          <Button
            variant="ghost"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Načítavam…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* LIST (karty) + 2-polohový swipe */}
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
                  time_str: b.time_str ?? (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
                  achieved_at: isoDateOnly(b.achieved_at),
                  activity_id: b.activity_id != null ? String(b.activity_id) : "",
                  activity_name: (b as any).activity_name ?? "",
                });
              }}
              onDelete={() => handleDelete(b.distance_m)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="Set as favorite"
                      variant="ghost"
                      size="sm"
                      circle
                      onClick={() => setFavM(b.distance_m)}
                      className={
                        favoriteM === b.distance_m ? "text-yellow-400" : "text-gray-400"
                      }
                    >
                      ★
                    </Button>
                    <div className="text-sm font-medium truncate">
                      {distanceLabel(b.distance_m, "run")}
                    </div>
                  </div>

                  <div className="mt-1 text-2xl font-extrabold tabular-nums leading-none">
                    {b.best_time_s != null ? secToHHMMSS(b.best_time_s) : b.time_str ?? "—"}
                  </div>

                  <div className="mt-1 text-xs opacity-75">
                    {isoDateOnly(b.achieved_at)}
                    {(b as any).activity_name ? (
                      <>
                        {" · "}
                        <button
                          className="underline hover:opacity-100 opacity-90"
                          onClick={() => {
                            if (b.activity_id != null) setDetailId(Number(b.activity_id));
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
        {rows.length === 0 && <li className="text-sm opacity-70">No records yet.</li>}
      </ul>

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

/* -------------------- SwipeRow (2-polohové) -------------------- */
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
  const startTx = useRef<number>(0);

  const snap = (x: number) =>
    setTx(Math.abs(x) > ACTION_W / 2 ? SNAP_OPEN : SNAP_CLOSED);

  return (
    <li
      className="relative rounded border border-gray-700/60 overflow-hidden"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        startTx.current = tx;
      }}
      onTouchMove={(e) => {
        if (startX.current == null) return;
        const dx = e.touches[0].clientX - startX.current;
        const next = Math.max(SNAP_OPEN, Math.min(0, startTx.current + dx));
        setTx(next);
      }}
      onTouchEnd={() => {
        snap(tx);
        startX.current = null;
      }}
    >
      {/* action panel pod obsahom */}
      <div className="absolute inset-y-0 right-0 flex w-[160px] z-0">
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

      {/* obsah nad akciami */}
      <div
        className="relative z-10 bg-gray-800 px-3 py-2"
        style={{ transform: `translateX(${tx}px)`, transition: "transform 160ms ease-out" }}
      >
        {children}
      </div>
    </li>
  );
}