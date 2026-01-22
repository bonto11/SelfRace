"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetBests,
  apiSaveBest,
  apiDeleteBest,
} from "@/app/features/bests/api/bests";

import {
  distanceOptions,
  distanceLabel,
} from "@/app/features/bests/utils/bests";

import { UserBest, PBRunFormState } from "@/app/features/bests/types/bests";

import { secToHHMMSS, maskHHMMSS, hhmmssToSec } from "@/app/shared/utils/time";
import { useFavoritePBRun } from "@/app/features/bests/hooks/useFavoritePBRun";
import ActivitySelector from "@/app/shared/components/ActivitySelector";
import SessionCard from "@/app/shared/components/session/SessionCard";
import { toast } from "@/app/shared/components/ui/Toast";
import { confirm } from "@/app/shared/components/ui/Confirm";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { inputClass } from "@/app/shared/ui";
import { NO_X, SURFACE_INLINE } from "@/app/shared/theme/uiTokens";
import { useIsTouch } from "@/app/shared/utils/detection";
import type { MiniActivity } from "@/app/features/activities/types/activities";

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: undefined,
};

const isoDateOnly = (s?: string | null) => (s ? s.slice(0, 10) : "");
const prettyDate = (s?: string) => (s ? s.replaceAll("-", ".") : "YYYY-MM-DD");

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBRun(); // perzistencia -> DB + storage (hook to rieši)
  const favoriteM = favM ?? 5000;
  const isTouch = useIsTouch();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* load */
  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await apiGetBests(userId, "run"));
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (userId) refresh(); /* eslint-disable-line */
  }, [userId]);

  /* guards */
  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    return Number.isFinite(m) && m > 0 && !!form.time_str.trim() && !saving;
  }, [form.distance_m, form.time_str, saving]);

  /* actions */
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
      if (form.activity_id !== "")
        payload.activity_id = Number(form.activity_id);
      if (form.activity_name !== undefined)
        payload.activity_name = form.activity_name.trim();
      if (form.achieved_at)
        payload.achieved_at = form.achieved_at.replace(/\./g, "-");

      await apiSaveBest(userId, payload);
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
      await apiDeleteBest(userId, m, "run");
      toast.success("Record deleted");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  /* UI */
  return (
    <div className={["space-y-4", NO_X].join(" ")}>
      <div className="text-xs opacity-80">
        Favorite distance: <strong>{distanceLabel(favoriteM, "run")}</strong>
      </div>

      {/* FORM */}
      <div
        className={["grid gap-3 sm:grid-cols-12 items-start", NO_X].join(" ")}
      >
        <select
          className={[inputClass, "sm:col-span-3"].join(" ")}
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

        <TextField
          placeholder="hh:mm:ss"
          value={form.time_str}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              time_str: maskHHMMSS((e.target as HTMLInputElement).value),
            }))
          }
          inputMode="numeric"
          containerClassName="sm:col-span-3"
        />

        <div className="relative sm:col-span-2 w-full max-w-[180px]">
          <div className={inputClass + " text-center select-none truncate"}>
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
              setForm((f) => ({ ...f, activity_name: a ? a.name : "" }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end sm:col-span-12">
          <Button onClick={handleSave} disabled={!canSave} variant="success">
            {saving ? "Ukladám…" : "Uložiť"}
          </Button>
          <Button variant="secondary" onClick={() => setForm(EMPTY)}>
            Clear
          </Button>
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            {loading ? "Načítavam…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* LIST – Swipe + SessionCard (variant="pb") */}
      <ul className={["space-y-2", NO_X].join(" ")}>
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => {
            const actId = b.activity_id != null ? Number(b.activity_id) : null;
            const timeDB =
              b.best_time_s != null
                ? secToHHMMSS(b.best_time_s)
                : b.time_str ?? "—";
            const dist = distanceLabel(b.distance_m, "run");
            const isFav = b.distance_m === favoriteM;

            const doEdit = () => {
              setForm({
                distance_m: String(b.distance_m),
                time_str:
                  b.time_str ??
                  (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
                achieved_at: isoDateOnly(b.achieved_at),
                activity_id: b.activity_id != null ? String(b.activity_id) : "",
                activity_name: (b as any).activity_name ?? "",
              });
            };
            const doDelete = () => handleDelete(b.distance_m);
            const toggleFav = async () => {
              try {
                await setFavM(b.distance_m);
                toast.success(`★ Favorite: ${dist}`);
              } catch (e: any) {
                toast.error(String(e?.message ?? e));
              }
            };

            const card = (
              <SessionCard
                variant="pb"
                item={{
                  id: b.distance_m,
                  kind: "activity",
                  title: dist,
                  dateIso: isoDateOnly(b.achieved_at),
                  sport: "run",
                  activityId: actId ?? 0, // musí byť number; keď nemáš activityId, daj 0
                  timeStr: timeDB,
                  distanceStr: dist.replace("— ", ""),
                  defaultOpen: false,

                  isFavorite: isFav,
                  onToggleFavorite: toggleFav,
                  onEdit: doEdit,
                  onDelete: doDelete,
                }}
              />
            );

            // ak chýba activityId, nech to stále renderuje card, len detail nebude mať streams
            // (getSummary/getStreams sa pri activityId=0 typicky nič nenájde)
            // Ak chceš prísnejšie: môžeš vyrobiť kind:"external" pre PB bez activityId.

            if (isTouch) {
              return (
                <SwipeRow
                  key={b.distance_m}
                  enableSwipe
                  onEdit={doEdit}
                  onDelete={doDelete}
                >
                  {card}
                </SwipeRow>
              );
            }

            return <li key={b.distance_m}>{card}</li>;
          })}

        {rows.length === 0 && (
          <li className="text-sm opacity-70">No records yet.</li>
        )}
      </ul>
    </div>
  );
}

/* --- SwipeRow (touch events – pripojené správne) --- */
function SwipeRow({
  children,
  onEdit,
  onDelete,
  enableSwipe = true,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  enableSwipe?: boolean;
}) {
  const [tx, setTx] = useState(0);
  const startX = useRef<number | null>(null);
  const startTx = useRef<number>(0);

  const ACTION_W = 168;
  const SNAP_OPEN = -ACTION_W;
  const SNAP_CLOSED = 0;
  const THRESHOLD = 8;

  const clamp = (v: number) => Math.max(SNAP_OPEN, Math.min(SNAP_CLOSED, v));
  const snap = (v: number) =>
    setTx(Math.abs(v) > ACTION_W / 2 ? SNAP_OPEN : SNAP_CLOSED);

  function onTouchStart(e: React.TouchEvent) {
    if (!enableSwipe) return;
    startX.current = e.touches[0].clientX;
    startTx.current = tx;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!enableSwipe || startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) < THRESHOLD) return;
    // blokuj horizontálne scrollovanie počas drag-u
    e.preventDefault();
    setTx(clamp(startTx.current + dx));
  }
  function onTouchEnd() {
    if (!enableSwipe) return;
    snap(tx);
    startX.current = null;
  }

  return (
    <li
      className={["relative w-full overflow-hidden select-none", NO_X].join(
        " "
      )}
      style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* akcie vpravo */}
      <div className="absolute inset-y-0 right-0 z-0 flex items-center gap-2 pr-3 pl-2">
        <button
          className="h-9 px-3 min-w-[72px] rounded-full text-sm font-semibold
                     bg-amber-500/60 hover:bg-amber-500/80 text-white
                     border border-white/10 transition-colors"
          onClick={() => {
            setTx(SNAP_CLOSED);
            onEdit();
          }}
        >
          Edit
        </button>
        <button
          className="h-9 px-3 min-w-[72px] rounded-full text-sm font-semibold
                     bg-rose-500/65 hover:bg-rose-500/80 text-white
                     border border-white/10 transition-colors"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      {/* obsah – posúvaný horizontálne */}
      <div
        className="relative z-10 w-full box-border will-change-transform"
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
