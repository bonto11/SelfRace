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

import type {
  UserBest,
  PBRunFormState,
} from "@/app/features/bests/types/bests";

import { secToHHMMSS, hhmmssToSec } from "@/app/shared/utils/time";
import { useFavoritePBHyrox } from "@/app/features/bests/hooks/useFavoritePBHyrox";
import ActivitySelector from "@/app/shared/ui/components/ActivitySelector";
import SessionCard from "@/app/shared/components/session/SessionCard";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";

// ✅ Import našich nových komponentov
import TimeSelectorField from "@/app/shared/ui/components/TimeSelectorField";
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";

import { useIsTouch } from "@/app/shared/utils/detection";
import type { MiniActivity } from "@/app/features/activities/types/activities";
import { useT } from "@/app/shared/i18n/useT";

import {
  PANEL_STACK,
  PANEL_PREVIEW,
  PANEL_ACTIONS_INLINE,
  PANEL_LIST,
  PANEL_SECTION,
  PANEL_SECTION_LABEL,
  PANEL_SECTION_TEXT,
  PANEL_PAD,
  PANEL_INNER_STACK,
  SWIPE_ROW,
  SWIPE_ACTIONS,
  SWIPE_CONTENT,
} from "@/app/shared/ui/tokens";

import {
  SESSION_INLINE,
  SESSION_INLINE_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

const EMPTY: PBRunFormState = {
  distance_m: "",
  time_str: "",
  achieved_at: "",
  activity_id: "",
  activity_name: undefined,
  total_distance_km: "",
  total_time_str: "",
};

const isoDateOnly = (s?: string | null) => (s ? s.slice(0, 10) : "");

export default function PBRun() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBHyrox();
  const favoriteM = favM ?? 1;
  const isTouch = useIsTouch();
  const t = useT();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await apiGetBests(userId, "run"));
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.bests.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) refresh(); /* eslint-disable-line */
  }, [userId]);

  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    // Overíme, či časový string nie je prázdny a či neobsahuje len nuly
    const validTime =
      form.time_str.trim() !== "" &&
      form.time_str !== "00:00:00" &&
      form.time_str !== "00:00";
    return Number.isFinite(m) && m > 0 && validTime && !saving;
  }, [form.distance_m, form.time_str, saving]);

  const distanceSelectOptions = useMemo(() => {
    return [
      { value: "", label: `— ${t("PB.chooseDist")}  —` },
      ...distanceOptions("run").map((o) => ({
        value: String(o.m),
        label: o.label,
      })),
    ];
  }, [t]);

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

      // Pripravíme voliteľné total fields pre payload
      if (form.total_distance_km) {
        payload.total_distance_m = Math.round(
          parseFloat(form.total_distance_km.replace(",", ".")) * 1000,
        );
      }
      if (form.total_time_str) {
        const tSec = hhmmssToSec(form.total_time_str.trim());
        if (Number.isFinite(tSec)) payload.total_time_s = tSec;
      }

      await apiSaveBest(userId, payload);
      toast.success(t("PB.saved"));
      setForm(EMPTY);
      await refresh();
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.bests.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: number) => {
    const ok = await confirm({
      title: t("PB.removeTitle"),
      message: `${t("PB.removeMessage")}\n(${distanceLabel(m, "run")})`,
      okText: t("PB.removeConfirm"),
      cancelText: t("PB.removeCancel"),
      tone: "danger",
    });
    if (!ok || !userId) return;

    try {
      await apiDeleteBest(userId, m, "run");
      toast.success(t("PB.deleted"));
      await refresh();
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.bests.deleteFailed"));
    }
  };

  return (
    <div className={PANEL_STACK}>
      <div className={PANEL_SECTION}>
        <div className={PANEL_SECTION_LABEL}>{t("PB.favorite")}</div>
        <div className={PANEL_SECTION_TEXT}>
          <strong>{distanceLabel(favoriteM, "run")}</strong>
        </div>
      </div>

      {/* FORM */}
      <div
        className={[SESSION_INLINE, PANEL_PAD, PANEL_INNER_STACK].join(" ")}
        style={SESSION_INLINE_STYLE}
      >
        <div className="grid gap-3 sm:grid-cols-12 items-start">
          <div className="sm:col-span-3">
            <SelectField
              value={form.distance_m}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  distance_m: (e.target as HTMLSelectElement).value,
                }))
              }
              options={distanceSelectOptions as any}
            />
          </div>

          <div className="sm:col-span-3">
            {/* ✅ Nahradené za TimeSelectorField */}
            <TimeSelectorField
              hh={true}
              mm={true}
              ss={true}
              value={form.time_str || "00:00:00"}
              onChange={(val) =>
                setForm((f) => ({
                  ...f,
                  time_str: val,
                }))
              }
            />
          </div>

          <div className="sm:col-span-2">
            <DateField
              value={form.achieved_at || null}
              onChange={(v) => setForm((f) => ({ ...f, achieved_at: v || "" }))}
            />
          </div>

          <div className="sm:col-span-4">
            <ActivitySelector
              userId={userId ?? null}
              dateIso={form.achieved_at}
              sports={["run", "mixed"]}
              value={form.activity_id ? Number(form.activity_id) : ""}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  activity_id: v === "" ? "" : String(v),
                }))
              }
              onPicked={(a: MiniActivity | null) =>
                setForm((f) => ({ ...f, activity_name: a ? a.name : "" }))
              }
            />
          </div>

          {/* VOLITEĽNÉ CELKOVÉ DÁTA */}
          <div className="sm:col-span-6 grid grid-cols-2 gap-3 p-3 bg-black/10 rounded-lg border border-white/5">
            <NumberWheelField
              min={0}
              max={200}
              step={0.1}
              value={
                form.total_distance_km
                  ? Number(form.total_distance_km.replace(",", "."))
                  : ""
              }
              onChange={(val) =>
                setForm((f) => ({ ...f, total_distance_km: String(val) }))
              }
            />

            <TimeSelectorField
              hh={true}
              mm={true}
              ss={true}
              value={form.total_time_str || "00:00:00"}
              onChange={(val) =>
                setForm((f) => ({
                  ...f,
                  total_time_str: val,
                }))
              }
            />
          </div>

          <div className={["sm:col-span-12", PANEL_ACTIONS_INLINE].join(" ")}>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              variant="success"
              size="xs"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>

            <Button
              variant="secondary"
              onClick={() => setForm(EMPTY)}
              size="xs"
            >
              {t("common.undo") || "Clear"}
            </Button>

            <Button
              variant="ghost"
              onClick={refresh}
              disabled={loading}
              size="xs"
            >
              {loading ? t("common.loading") : t("common.refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* LIST */}
      <ul className={PANEL_LIST}>
        {rows
          .slice()
          .sort((a, b) => a.distance_m - b.distance_m)
          .map((b) => {
            const actId = b.activity_id != null ? Number(b.activity_id) : null;
            const timeDB =
              b.best_time_s != null
                ? secToHHMMSS(b.best_time_s)
                : (b.time_str ?? "—");
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
                // Natiahneme aj total dáta do formulára
                total_distance_km: b.total_distance_m
                  ? (b.total_distance_m / 1000).toFixed(2)
                  : "",
                total_time_str: b.total_time_s
                  ? secToHHMMSS(b.total_time_s)
                  : "",
              });
            };

            const doDelete = () => handleDelete(b.distance_m);

            const toggleFav = async () => {
              try {
                await setFavM(b.distance_m);
                toast.success(`★ ${t("PB.favorite")}: ${dist}`);
              } catch (e: any) {
                toast.error(String(e?.message ?? e));
              }
            };

            const card = (
              <SessionCard
                variant="pb"
                item={
                  {
                    id: b.distance_m,
                    kind: "bests",
                    title: dist,
                    dateIso: isoDateOnly(b.achieved_at),
                    sport: "run",
                    activityId: actId ?? 0,
                    timeStr: timeDB,
                    distanceStr: dist.replace("— ", ""),
                    defaultOpen: false,
                    isFavorite: isFav,
                    onToggleFavorite: toggleFav,
                    onEdit: doEdit,
                    onDelete: doDelete,
                  } as any
                }
              />
            );

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

        {rows.length === 0 && !loading && (
          <li className={PANEL_PREVIEW}>{t("PB.noRecords")}</li>
        )}
      </ul>
    </div>
  );
}

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
  const t = useT();
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
      className={SWIPE_ROW}
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className={SWIPE_ACTIONS}>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            setTx(SNAP_CLOSED);
            onEdit();
          }}
        >
          {t("common.edit")}
        </Button>
        <Button size="xs" variant="danger" onClick={onDelete}>
          {t("common.delete")}
        </Button>
      </div>

      <div
        className={[
          SWIPE_CONTENT,
          "transition-transform duration-150 ease-out",
        ].join(" ")}
        style={{ transform: `translateX(${tx}px)` }}
      >
        {children}
      </div>
    </li>
  );
}
