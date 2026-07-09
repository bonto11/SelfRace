"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetBests,
  apiSaveBest,
  apiDeleteBest,
} from "@/app/features/bests/api/bests";
import { distanceOptions } from "@/app/features/bests/utils/bests";
import type { UserBest } from "@/app/features/bests/types/bests";
import { useFavoritePBStrength } from "@/app/features/bests/hooks/useFavoritePBStrength";

import ActivitySelector from "@/app/shared/ui/components/ActivitySelector";
import SessionCard from "@/app/shared/components/session/SessionCard";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import TextField from "@/app/shared/ui/components/TextField";

import { useIsTouch } from "@/app/shared/utils/detection";
import type { MiniActivity } from "@/app/features/activities/types/activities";
import { useT } from "@/app/shared/i18n/useT";

import {
  PANEL_STACK,
  PANEL_PREVIEW,
  PANEL_ACTIONS_INLINE,
  PANEL_LIST,
  PANEL_PAD,
  PANEL_INNER_STACK,
  INPUTS_CARD_BODY,
  SWIPE_ROW,
  SWIPE_ACTIONS,
  SWIPE_CONTENT,
} from "@/app/shared/ui/tokens";
import {
  SESSION_INLINE,
  SESSION_INLINE_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

type PBStrengthFormState = {
  distance_m: string;
  record_value: string;
  record_unit: string;
  achieved_at: string;
  activity_id: string;
  activity_name?: string;
};

const EMPTY: PBStrengthFormState = {
  distance_m: "",
  record_value: "",
  record_unit: "kg",
  achieved_at: "",
  activity_id: "",
  activity_name: undefined,
};

const isoDateOnly = (s?: string | null) => (s ? s.slice(0, 10) : "");

export default function PBStrength() {
  const { userId } = useUserId();
  const { favM, setFavM } = useFavoritePBStrength();
  const favoriteM = favM ?? 1;
  const isTouch = useIsTouch();
  const t = useT();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBStrengthFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await apiGetBests(userId, "strength"));
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
    return Number.isFinite(m) && m > 0 && !!form.record_value.trim() && !saving;
  }, [form.distance_m, form.record_value, saving]);

  const getExerciseName = (m: number) => {
    const keys: Record<number, string> = {
      1: "bench",
      2: "squat",
      3: "deadlift",
      4: "ohp",
      5: "pullups",
      6: "clean",
      7: "snatch",
    };
    const k = keys[m];
    return k ? ((t as any)(`PB.exercises.${k}`) as string) : `Exercise ${m}`;
  };

  const exerciseOptions = useMemo(() => {
    return [
      { value: "", label: `— ${t("PB.chooseExercise")} —` },
      ...distanceOptions("strength").map((o) => ({
        value: String(o.m),
        label: getExerciseName(o.m),
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const previewText = useMemo(() => {
    const favLabel = getExerciseName(favoriteM);
    const count = rows.length;
    return count > 0
      ? `${t("PB.favoriteExercise")}: ${favLabel} · ${count} ${t("PB.recordsCount") || "záznamov"}`
      : `${t("PB.favoriteExercise")}: ${favLabel}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteM, rows.length, t]);

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const m = Number(form.distance_m);
      const val = form.record_value.trim();
      const unit = form.record_unit;

      const payload: any = {
        sport: "strength",
        distance_m: m,
        time_str: `${val} ${unit}`,
      };

      if (form.activity_id !== "")
        payload.activity_id = Number(form.activity_id);
      if (form.activity_name !== undefined)
        payload.activity_name = form.activity_name.trim();
      if (form.achieved_at)
        payload.achieved_at = form.achieved_at.replace(/\./g, "-");

      await apiSaveBest(userId, payload);
      toast.success(t("PB.saved"));
      setForm(EMPTY);
      await refresh();
    } catch (e: any) {
      toast.error(t("api.bests.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: number) => {
    const ok = await confirm({
      title: t("PB.removeTitle"),
      message: `${t("PB.removeMessage")}\n(${getExerciseName(m)})`,
      okText: t("PB.removeConfirm"),
      cancelText: t("PB.removeCancel"),
      tone: "danger",
    });
    if (!ok || !userId) return;
    try {
      await apiDeleteBest(userId, m, "strength");
      toast.success(t("PB.deleted"));
      await refresh();
    } catch (e: any) {
      toast.error(t("api.bests.deleteFailed"));
    }
  };

  return (
    <InputsCard
      title={t("PB.strength.title") || "Silový tréning"}
      subtitle={t("PB.strength.subtitle") as any}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div
          className={[SESSION_INLINE, PANEL_PAD, PANEL_INNER_STACK].join(" ")}
          style={SESSION_INLINE_STYLE}
        >
          <div className="grid gap-3 sm:grid-cols-12 items-start">
            <div className="sm:col-span-5">
              <SelectField
                value={form.distance_m}
                onChange={(e) =>
                  setForm((f) => ({ ...f, distance_m: e.target.value }))
                }
                options={exerciseOptions as any}
              />
            </div>

            <div className="sm:col-span-3 flex gap-2">
              <TextField
                placeholder={t("PB.recordValue")}
                value={form.record_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, record_value: e.target.value }))
                }
                inputMode="decimal"
                containerClassName="flex-1"
              />
              <SelectField
                value={form.record_unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, record_unit: e.target.value }))
                }
                options={[
                  { value: "kg", label: "kg" },
                  { value: "lbs", label: "lbs" },
                  { value: "reps", label: "op." },
                ]}
                containerClassName="w-20"
              />
            </div>

            <div className="sm:col-span-4">
              <DateField
                value={form.achieved_at || null}
                onChange={(v) => setForm((f) => ({ ...f, achieved_at: v || "" }))}
              />
            </div>

            <div className="sm:col-span-12">
              <ActivitySelector
                userId={userId ?? null}
                dateIso={form.achieved_at}
                sports={["workout", "mixed"]}
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
                {t("common.loading") || "Refresh"}
              </Button>
            </div>
          </div>
        </div>

        <ul className={PANEL_LIST}>
          {rows
            .slice()
            .sort((a, b) => a.distance_m - b.distance_m)
            .map((b) => {
              const actId = b.activity_id != null ? Number(b.activity_id) : null;
              const displayValue = b.time_str ?? "—";
              const dist = getExerciseName(b.distance_m);
              const isFav = b.distance_m === favoriteM;

              const doEdit = () => {
                const [val, unit] = (b.time_str || " ").split(" ");
                setForm({
                  distance_m: String(b.distance_m),
                  record_value: val || "",
                  record_unit: unit || "kg",
                  achieved_at: isoDateOnly(b.achieved_at),
                  activity_id: b.activity_id != null ? String(b.activity_id) : "",
                  activity_name: (b as any).activity_name ?? "",
                });
              };

              const doDelete = () => handleDelete(b.distance_m);

              const toggleFav = async () => {
                try {
                  await setFavM(b.distance_m);
                  toast.success(`★ ${t("PB.favoriteExercise")}: ${dist}`);
                } catch (e: any) {
                  toast.error("Chyba");
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
                      sport: "strength",
                      activityId: actId ?? 0,
                      timeStr: displayValue,
                      distanceStr: "",
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
        </ul>
      </div>
    </InputsCard>
  );
}

function SwipeRow({ children, onEdit, onDelete, enableSwipe = true }: any) {
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
