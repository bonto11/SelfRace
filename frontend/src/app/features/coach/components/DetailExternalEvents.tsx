// src/app/features/coach/components/DetailExternalEvents.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import TimeField24 from "@/app/shared/ui/components/TimeField24";

import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

import {
  apiGetExternalEvents,
  apiSaveExternalEvents,
} from "@/app/features/coach/api/coach_external_events";

import type {
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
  ExternalEvent,
  ExternalCategory,
} from "@/app/features/coach/types/externalEvents";

import {
  ALL_DAYS,
  DAY_TO_INT,
  INT_TO_DAY,
  JS_TO_DAY,
  niceLabelForDay,
  normalizeWeekdayToInt,
  type DayAbbrev,
} from "@/app/shared/utils/weekday";

import {
  FORM_GRID_TWO,
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";

type Props = {
  userId?: number;
};

/* ---------- constants ---------- */

const SPORT_OPTIONS: ExternalSport[] = [
  "run",
  "ride",
  "strength",
  "swim",
  "football",
  "badminton",
  "floorbal",
  "padel",
  "tennis",
  "other",
];

const EVENT_OPTIONS: any[] = [
  "wedding",
  "travel",
  "party",
  "work",
  "family",
  "other_event",
];

const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];

/* ---------- prekladové helpery (prijímajú t) ---------- */

function detectCategory(sport: ExternalSport | null): ExternalCategory {
  if (!sport) return "sport";
  if ((EVENT_OPTIONS as string[]).includes(String(sport))) return "event";
  return "sport";
}

function getSportLabel(s: any, t: any): string {
  if ((EVENT_OPTIONS as string[]).includes(String(s))) {
    return t(`externalEvents.events.${s}`);
  }
  return t(`externalEvents.sports.${s}`);
}

function getIntensityLabel(i: ExternalIntensity, t: any): string {
  return t(`externalEvents.intensities.${i}`);
}

/* ---------- mapovanie DB ↔️ FE ---------- */

function mapEventsToActivities(events: ExternalEvent[]): ExternalActivity[] {
  return (events ?? [])
    .map<ExternalActivity | null>((ev) => {
      const mode = (ev.recurrence_kind as "weekly" | "single") ?? "weekly";
      let day: DayAbbrev = "Mon";

      if (mode === "weekly") {
        const weekdayRaw = (ev as any).weekday_int ?? (ev as any).weekday ?? (ev as any).weekday_text ?? null;
        const weekdayNum = normalizeWeekdayToInt(weekdayRaw);
        day = weekdayNum ? INT_TO_DAY[weekdayNum] : "Mon";
      } else {
        const iso = (ev as any).single_date as string | null;
        if (!iso) return null;
        const dObj = new Date(iso);
        day = JS_TO_DAY[dObj.getDay()] ?? "Mon";
      }

      const sport = (ev.sport as any) ?? "other";
      let intensity: ExternalIntensity = "moderate";
      if (ev.priority === "fixed") intensity = "high";
      if (ev.priority === "optional") intensity = "low";

      return {
        category: detectCategory(sport),
        day,
        sport,
        intensity,
        note: ev.notes ?? ev.title ?? undefined,
        mode,
        date_single: (ev.single_date as string | null) ?? null,
        time: ev.start_time_local ?? null,
      };
    })
    .filter(Boolean) as ExternalActivity[];
}

function mapActivitiesToEvents(
  userId: number,
  activities: ExternalActivity[],
  t: any
): ExternalEvent[] {
  return activities.map<ExternalEvent>((a) => {
    const mode = a.mode ?? "weekly";
    const weekday_int = mode === "weekly" ? (DAY_TO_INT[a.day] ?? 1) : null;
    let priority: "fixed" | "optional" = "optional";
    if (a.intensity === "high") priority = "fixed";

    const baseTitle = getSportLabel(a.sport as any, t);
    const title = a.note ? `${baseTitle} – ${a.note}` : baseTitle;

    return {
      id: 0 as any,
      user_id: userId,
      title,
      sport: a.sport as any,
      weekday_int,
      recurrence_kind: mode,
      single_date: mode === "single" ? (a.date_single ?? null) : null,
      start_time_local: a.time ?? null,
      priority,
      notes: a.note ?? null,
    } as any;
  });
}

/* ---------- komponent ---------- */

export function DetailExternalEvents({ userId }: Props) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<ExternalActivity[]>([]);

  const [draft, setDraft] = useState<ExternalActivity>({
    category: "sport",
    day: "Wed",
    sport: "football" as any,
    intensity: "high",
    note: "",
    mode: "weekly",
    date_single: null,
    time: null,
  });

  const [loadingDB, setLoadingDB] = useState(false);
  const [savingDB, setSavingDB] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbInfo, setDbInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoadingDB(true);
      setDbError(null);
      setDbInfo(null);
      try {
        const events = await apiGetExternalEvents(userId);
        if (!alive) return;
        setList(mapEventsToActivities(events ?? []));
      } catch (e: any) {
        if (!alive) return;
        setDbError(t(e?.message as any) || t("externalEvents.errors.loadFailed"));
      } finally {
        if (alive) setLoadingDB(false);
      }
    })();

    return () => { alive = false; };
  }, [userId, t]);

  const previewSorted = useMemo(() => {
    const order = Object.fromEntries(ALL_DAYS.map((d, i) => [d, i]));
    return [...list].sort((a, b) => {
      const d = (order[a.day] ?? 0) - (order[b.day] ?? 0);
      if (d !== 0) return d;
      const s = String(a.sport).localeCompare(String(b.sport));
      if (s !== 0) return s;
      return String(a.intensity).localeCompare(String(b.intensity));
    });
  }, [list]);

  const previewText = useMemo(() => {
    if (!userId) return t("externalEvents.preview.noUser");
    if (loadingDB) return t("externalEvents.preview.loading");
    if (!previewSorted.length) return t("externalEvents.preview.empty");

    const top = previewSorted.slice(0, 3).map((a) => {
      const when = (a.mode ?? "weekly") === "weekly" ? niceLabelForDay(a.day) : (a.date_single ?? niceLabelForDay(a.day));
      return `${when} · ${getSportLabel(a.sport as any, t)} · ${getIntensityLabel(a.intensity, t)}`;
    });

    return top.join(" • ") + (previewSorted.length > 3 ? ` • +${previewSorted.length - 3}` : "");
  }, [userId, loadingDB, previewSorted, t]);

  const handleAdd = () => {
    const next: ExternalActivity = { ...draft, note: draft.note?.trim() || undefined };
    if ((next.mode ?? "weekly") === "single" && !next.date_single) {
      toast.error(t("externalEvents.errors.missingDate"));
      return;
    }
    setList((cur) => [...cur, next]);
  };

  const handleRemove = (idx: number) => setList((cur) => cur.filter((_, i) => i !== idx));

  const handleSaveToDB = async () => {
    if (!userId) return;
    setSavingDB(true);
    setDbError(null);
    setDbInfo(null);
    try {
      const cleaned = list.filter((a) => String(a.sport || "").trim().length);
      const events = mapActivitiesToEvents(userId, cleaned, t);
      const resp = await apiSaveExternalEvents(userId, events);

      setDbInfo(t("externalEvents.info.saved")
        .replace("{{count}}", String(resp.count))
        .replace("{{deleted}}", String(resp.deleted))
        .replace("{{inserted}}", String(resp.inserted))
      );
      setOpen(false);
    } catch (e: any) {
      setDbError(t(e?.message as any) || t("externalEvents.errors.saveFailed"));
    } finally {
      setSavingDB(false);
    }
  };

  const handleClearDB = async () => {
    if (!userId) return;
    setSavingDB(true);
    setDbError(null);
    setDbInfo(null);
    try {
      await apiSaveExternalEvents(userId, []);
      setList([]);
      setDbInfo(t("externalEvents.info.deleted"));
    } catch (e: any) {
      setDbError(t(e?.message as any) || t("externalEvents.errors.deleteFailed"));
    } finally {
      setSavingDB(false);
    }
  };

  const mode = draft.mode ?? "weekly";
  const isWeekly = mode === "weekly";
  const category: ExternalCategory = draft.category ?? "sport";
  const sportOptions: any[] = category === "sport" ? SPORT_OPTIONS : EVENT_OPTIONS;

  const disabled = !userId || savingDB;

  return (
    <InputsCard
      title={t("externalEvents.title")}
      subtitle={t("externalEvents.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSaveToDB}
          disabled={savingDB || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {savingDB ? t("externalEvents.form.saving") : t("externalEvents.form.saveBtn")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("externalEvents.form.type")}
            </div>
            <SelectField
              disabled={disabled}
              value={String(category)}
              onChange={(e) => {
                const nextCat = (e.target.value as ExternalCategory) || "sport";
                setDraft((d) => ({ ...d, category: nextCat, sport: nextCat === "sport" ? SPORT_OPTIONS[0] : (EVENT_OPTIONS[0] as any) }));
              }}
              options={[
                { value: "sport", label: t("externalEvents.form.categorySport") },
                { value: "event", label: t("externalEvents.form.categoryEvent") },
              ]}
            />
          </section>

          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("externalEvents.form.recurrence")}
            </div>
            <SelectField
              disabled={disabled}
              value={String(mode)}
              onChange={(e) => setDraft((d) => ({ ...d, mode: (e.target.value as "weekly" | "single") || "weekly" }))}
              options={[
                { value: "weekly", label: t("externalEvents.form.weekly") },
                { value: "single", label: t("externalEvents.form.single") },
              ]}
            />
          </section>

          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {isWeekly ? t("externalEvents.form.day") : t("externalEvents.form.date")}
            </div>
            {isWeekly ? (
              <SelectField
                disabled={disabled}
                value={String(draft.day)}
                onChange={(e) => setDraft((d) => ({ ...d, day: (e.target.value as DayAbbrev) || "Mon" }))}
                options={ALL_DAYS.map((d) => ({ value: d, label: niceLabelForDay(d) }))}
              />
            ) : (
              <DateField disabled={disabled} value={draft.date_single} onChange={(v) => setDraft((d) => ({ ...d, date_single: v || null }))} />
            )}
          </section>

          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {category === "sport" ? t("externalEvents.form.categorySport") : t("externalEvents.form.categoryEvent")}
            </div>
            <SelectField
              disabled={disabled}
              value={String(draft.sport)}
              onChange={(e) => setDraft((d) => ({ ...d, sport: (e.target.value as any) || "other" }))}
              options={sportOptions.map((s) => ({ value: String(s), label: getSportLabel(s, t) }))}
            />
          </section>

          <section>
            <TimeField24 label={t("externalEvents.form.time")} value={draft.time ?? ""} onChange={(v) => setDraft((d) => ({ ...d, time: v || null }))} />
          </section>

          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("externalEvents.form.intensity")}
            </div>
            <SelectField
              disabled={disabled}
              value={String(draft.intensity)}
              onChange={(e) => setDraft((d) => ({ ...d, intensity: (e.target.value as ExternalIntensity) || "moderate" }))}
              options={EXT_INTENS.map((i) => ({ value: i, label: getIntensityLabel(i, t) }))}
            />
          </section>

          <section>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("externalEvents.form.note")}
            </div>
            <TextField placeholder={t("externalEvents.form.notePlaceholder")} value={draft.note ?? ""} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} disabled={disabled} />
          </section>

          <section>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAdd} size="sm" variant="success" disabled={disabled}>{t("externalEvents.form.btnAdd")}</Button>
              <Button size="sm" variant="danger" onClick={handleClearDB} disabled={disabled}>{t("externalEvents.form.btnClear")}</Button>
            </div>
            {dbError && <div className="mt-2 text-[11px] text-red-300">{dbError}</div>}
            {dbInfo && !dbError && <div className="mt-2 text-[11px] text-emerald-300">{dbInfo}</div>}
          </section>
        </div>

        {list.length > 0 && (
          <div className="mt-2">
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>{t("externalEvents.form.listHeader")}</div>
            <ul className="mt-2 space-y-2">
              {list.map((a, idx) => {
                const when = (a.mode ?? "weekly") === "weekly" ? niceLabelForDay(a.day) : a.date_single || niceLabelForDay(a.day);
                return (
                  <li key={`${a.day}-${String(a.sport)}-${idx}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-sm">
                      {when} · {getSportLabel(a.sport as any, t)} · {getIntensityLabel(a.intensity, t)}
                      {a.time ? ` · ${a.time}` : ""}
                      {a.note ? ` — ${a.note}` : ""}
                    </span>
                    <Button size="sm" variant="danger" onClick={() => handleRemove(idx)} disabled={savingDB}>{t("externalEvents.form.removeBtn")}</Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!userId && <div className="text-xs mt-2" style={{ color: appColors.textMuted }}>{t("externalEvents.errors.notLoggedIn")}</div>}
      </div>
    </InputsCard>
  );
}

export default DetailExternalEvents;