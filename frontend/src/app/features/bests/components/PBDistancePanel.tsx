"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetBests,
  apiSaveBest,
  apiDeleteBest,
} from "@/app/features/bests/api/bests";

import { distanceOptions, distanceLabel } from "@/app/features/bests/utils/bests";

import type {
  Sport,
  UserBest,
  PBRunFormState,
} from "@/app/features/bests/types/bests";

import { secToHHMMSS, hhmmssToSec } from "@/app/shared/utils/time";
import ActivitySelector from "@/app/shared/ui/components/ActivitySelector";
import SessionCard from "@/app/shared/components/session/SessionCard";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import TimeField from "@/app/shared/ui/components/TimeField";
import NumberField from "@/app/shared/ui/components/NumberField";
import SwipeRow from "@/app/shared/ui/components/SwipeRow";
import PBAgeBadge from "@/app/features/bests/components/PBAgeBadge";

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

export type PBDistancePanelProps = {
  /** DB/API sport kľúč — MUSÍ zodpovedať backendu ("run","ride","swim","triathlon","ocr","hyrox"). */
  sport: Sport;
  title: string;
  subtitle?: React.ReactNode;
  /** Zoznam pre ActivitySelector, napr. ["ride","virtualride","mixed"]. */
  activitySports: string[];
  /** Max hodnota pre celkovú vzdialenosť (NumberField), napr. 500 pre bike. */
  totalDistanceMax?: number;
  favM: number;
  setFavM: (m: number) => Promise<void> | void;
};

/**
 * Master komponent pre PB panely postavené na "distance + čas"
 * (Run, Bike, Swim, Triathlon, OCR, Hyrox). Predtým bol tento kód
 * duplikovaný v 6 samostatných súboroch — líšili sa len konfiguráciou
 * (sport, title, activity sports, max vzdialenosti, favorite hook).
 * PBStrength ostáva samostatný, keďže má úplne iný tvar formulára
 * (hodnota + jednotka namiesto času).
 */
export default function PBDistancePanel({
  sport,
  title,
  subtitle,
  activitySports,
  totalDistanceMax = 200,
  favM,
  setFavM,
}: PBDistancePanelProps) {
  const { userId } = useUserId();
  const isTouch = useIsTouch();
  const t = useT();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UserBest[]>([]);
  const [form, setForm] = useState<PBRunFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await apiGetBests(userId, sport));
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.bests.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sport]);

  const canSave = useMemo(() => {
    const m = Number(form.distance_m);
    const validTime =
      form.time_str.trim() !== "" &&
      form.time_str !== "00:00:00" &&
      form.time_str !== "00:00";
    return Number.isFinite(m) && m > 0 && validTime && !saving;
  }, [form.distance_m, form.time_str, saving]);

  const distanceSelectOptions = useMemo(() => {
    return [
      { value: "", label: `— ${t("PB.chooseDist")}  —` },
      ...distanceOptions(sport).map((o) => ({
        value: String(o.m),
        label: o.label,
      })),
    ];
  }, [t, sport]);

  const previewText = useMemo(() => {
    const favLabel = distanceLabel(favM, sport);
    const count = rows.length;
    return count > 0
      ? `${t("PB.favorite")}: ${favLabel} · ${count} ${t("PB.recordsCount") || "záznamov"}`
      : `${t("PB.favorite")}: ${favLabel}`;
  }, [favM, rows.length, t, sport]);

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const m = Number(form.distance_m);
      const sec = hhmmssToSec(form.time_str.trim());
      const payload: any = {
        sport,
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
      message: `${t("PB.removeMessage")}\n(${distanceLabel(m, sport)})`,
      okText: t("PB.removeConfirm"),
      cancelText: t("PB.removeCancel"),
      tone: "danger",
    });
    if (!ok || !userId) return;

    try {
      await apiDeleteBest(userId, m, sport);
      toast.success(t("PB.deleted"));
      await refresh();
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.bests.deleteFailed"));
    }
  };

  return (
    <InputsCard
      title={title}
      subtitle={subtitle}
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
              <TimeField
                hh mm ss
                value={form.time_str ?? ""}
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
                sports={activitySports}
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

            <div className="sm:col-span-6 grid grid-cols-2 gap-3 p-3 bg-black/10 rounded-lg border border-white/5">
              <NumberField
                min={0}
                max={totalDistanceMax}
                step={0.1}
                unit={t("common.units.km")}
                value={
                  form.total_distance_km
                    ? Number(form.total_distance_km.replace(",", "."))
                    : ""
                }
                onChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    total_distance_km: val === "" ? "" : String(val),
                  }))
                }
              />

              <TimeField
                hh mm ss
                value={form.total_time_str ?? ""}
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
              const dist = distanceLabel(b.distance_m, sport);
              const isFav = b.distance_m === favM;

              const doEdit = () => {
                setForm({
                  distance_m: String(b.distance_m),
                  time_str:
                    b.time_str ??
                    (b.best_time_s ? secToHHMMSS(b.best_time_s) : ""),
                  achieved_at: isoDateOnly(b.achieved_at),
                  activity_id: b.activity_id != null ? String(b.activity_id) : "",
                  activity_name: (b as any).activity_name ?? "",
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
                      sport,
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

              const wrappedCard = <PBAgeBadge best={b}>{card}</PBAgeBadge>;

              if (isTouch) {
                return (
                  <SwipeRow
                    key={b.distance_m}
                    enableSwipe
                    onEdit={doEdit}
                    onDelete={doDelete}
                  >
                    {wrappedCard}
                  </SwipeRow>
                );
              }

              return <li key={b.distance_m}>{wrappedCard}</li>;
            })}

          {rows.length === 0 && !loading && (
            <li className={PANEL_PREVIEW}>{t("PB.noRecords")}</li>
          )}
        </ul>
      </div>
    </InputsCard>
  );
}