// src/features/coach/components/DetailExternalEvents.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import SelectField from "@/app/shared/components/ui/SelectField";
import TextField from "@/app/shared/components/ui/TextField";
import DateField from "@/app/shared/components/ui/DateField";
import TimeField24 from "@/app/shared/components/ui/TimeField24";

import { toast } from "@/app/shared/components/ui/Toast";
import { appColors } from "@/app/shared/theme/app_colors";

import type { DayAbbrev } from "@/app/shared/types/day";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

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
  CARD,
  SECTION,
  FORM_GRID_TWO,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_STACK,
  PANEL_PREVIEW,
  SURFACE_CARD_STYLE,
  SECTION_STYLE,
  INPUTS_CARD_BODY,
  INPUTS_CARD_FOOTER,
  INPUTS_CARD_SAVE_WRAP,
  INPUTS_CARD_SAVE_BTN,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_TOGGLE,
} from "@/app/shared/ui/tokens";

type Props = {
  userId?: number;
};

/* ---------- constants ---------- */

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

const EVENT_OPTIONS: ExternalSport[] = [
  "wedding",
  "travel",
  "party",
  "work",
  "family",
  "other_event",
];

const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];

const DAY_TO_INT: Record<DayAbbrev, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const INT_TO_DAY: Record<number, DayAbbrev> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

const JS_TO_DAY: DayAbbrev[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- helpers ---------- */

function detectCategory(sport: ExternalSport | null): ExternalCategory {
  if (!sport) return "sport";
  if (EVENT_OPTIONS.includes(sport)) return "event";
  return "sport";
}

function niceLabelForSport(s: ExternalSport): string {
  switch (s) {
    case "run":
      return "Beh";
    case "ride":
      return "Bicykel";
    case "strength":
      return "Silový tréning";
    case "swim":
      return "Plávanie";
    case "football":
      return "Futbal";
    case "badminton":
      return "Bedminton";
    case "floorbal":
      return "Florbal";
    case "padel":
      return "Padel";
    case "tennis":
      return "Tenis";
    case "other":
      return "Iný šport";

    case "wedding":
      return "Svadba";
    case "travel":
      return "Cestovanie";
    case "party":
      return "Oslava / party";
    case "work":
      return "Pracovná udalosť";
    case "family":
      return "Rodinná udalosť";
    case "other_event":
      return "Iná udalosť";

    default:
      return String(s);
  }
}

function niceLabelForDay(d: DayAbbrev): string {
  switch (d) {
    case "Mon":
      return "Po";
    case "Tue":
      return "Ut";
    case "Wed":
      return "St";
    case "Thu":
      return "Št";
    case "Fri":
      return "Pi";
    case "Sat":
      return "So";
    case "Sun":
      return "Ne";
    default:
      return d;
  }
}

function niceLabelForIntensity(i: ExternalIntensity): string {
  switch (i) {
    case "low":
      return "Nízka";
    case "moderate":
      return "Stredná";
    case "high":
      return "Vysoká";
    default:
      return String(i);
  }
}

/* ---------- mapovanie DB ↔ FE ---------- */

function mapEventsToActivities(events: ExternalEvent[]): ExternalActivity[] {
  return events
    .map<ExternalActivity | null>((ev) => {
      const mode = (ev.recurrence_kind as "weekly" | "single") ?? "weekly";

      let day: DayAbbrev = "Mon";

      if (mode === "weekly") {
        const weekdayNum = Number((ev as any).weekday ?? (ev as any).weekday_int);
        day = INT_TO_DAY[weekdayNum] ?? "Mon";
      } else {
        const iso = (ev as any).single_date as string | null;
        if (!iso) return null;
        const dObj = new Date(iso);
        const js = dObj.getDay();
        day = JS_TO_DAY[js] ?? "Mon";
      }

      const sport = (ev.sport as ExternalSport) ?? "other";

      let intensity: ExternalIntensity = "moderate";
      if (ev.priority === "fixed") intensity = "high";
      if (ev.priority === "optional") intensity = "low";

      const note = ev.notes ?? ev.title ?? undefined;
      const time = ev.start_time_local ?? null;
      const singleDate = (ev.single_date as string | null) ?? null;
      const category = detectCategory(sport);

      return {
        category,
        day,
        sport,
        intensity,
        note,
        mode,
        date_single: singleDate,
        time,
      };
    })
    .filter(Boolean) as ExternalActivity[];
}

function mapActivitiesToEvents(userId: number, activities: ExternalActivity[]): ExternalEvent[] {
  return activities.map<ExternalEvent>((a) => {
    const mode = a.mode ?? "weekly";
    const weekday = mode === "weekly" ? DAY_TO_INT[a.day] ?? 1 : 1;

    let priority: "fixed" | "optional" = "optional";
    if (a.intensity === "high") priority = "fixed";

    const baseTitle = niceLabelForSport(a.sport);
    const title = a.note ? `${baseTitle} – ${a.note}` : baseTitle;

    return {
      id: 0 as any,
      user_id: userId,
      title,
      sport: a.sport,
      weekday,
      recurrence_kind: mode,
      single_date: mode === "single" ? a.date_single ?? null : null,
      start_time_local: a.time ?? null,
      duration_min: null,
      priority,
      notes: a.note ?? null,
      start_date: null,
      end_date: null,
      created_at: null,
      occurrence_date: undefined,
    };
  });
}

/* ---------- komponent ---------- */

export function DetailExternalEvents({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ExternalActivity[]>([]);

  const [draft, setDraft] = useState<ExternalActivity>({
    category: "sport",
    day: "Wed",
    sport: "football",
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
        setDbError(e?.message ?? "Nepodarilo sa načítať externé aktivity z DB.");
      } finally {
        if (!alive) return;
        setLoadingDB(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const previewSorted = useMemo(() => {
    const order = Object.fromEntries(ALL_DAYS.map((d, i) => [d, i]));
    return [...list].sort((a, b) => {
      const d = (order[a.day] ?? 0) - (order[b.day] ?? 0);
      if (d !== 0) return d;
      const s = a.sport.localeCompare(b.sport);
      if (s !== 0) return s;
      return a.intensity.localeCompare(b.intensity);
    });
  }, [list]);

  const previewText = useMemo(() => {
    if (!userId) return "Najprv sa prihlás, aby sme vedeli načítať a uložiť externé udalosti.";
    if (loadingDB) return "Načítavam externé aktivity z DB…";
    if (!previewSorted.length) return "Zatiaľ nemáš uložené žiadne externé aktivity.";
    const top = previewSorted.slice(0, 3).map((a) => {
      const when =
        (a.mode ?? "weekly") === "weekly"
          ? niceLabelForDay(a.day)
          : a.date_single ?? niceLabelForDay(a.day);
      return `${when} · ${niceLabelForSport(a.sport)} · ${niceLabelForIntensity(a.intensity)}`;
    });
    return top.join(" • ") + (previewSorted.length > 3 ? ` • +${previewSorted.length - 3}` : "");
  }, [userId, loadingDB, previewSorted]);

  const handleAdd = () => {
    const next: ExternalActivity = { ...draft, note: draft.note?.trim() || undefined };

    if ((next.mode ?? "weekly") === "single" && !next.date_single) {
      toast.error("Pri jednorazovej udalosti zadaj dátum.");
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
      const events = mapActivitiesToEvents(userId, cleaned);
      const resp = await apiSaveExternalEvents(userId, events);

      setDbInfo(`Uložené (${resp.count} eventov, zmazaných ${resp.deleted}, vložených ${resp.inserted}).`);
      setOpen(false);
    } catch (e: any) {
      setDbError(e?.message ?? "Chyba pri ukladaní do DB.");
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
      const resp = await apiSaveExternalEvents(userId, []);
      setList([]);
      setDbInfo(`Zmazané (deleted=${resp.deleted}).`);
    } catch (e: any) {
      setDbError(e?.message ?? "Chyba pri mazaní v DB.");
    } finally {
      setSavingDB(false);
    }
  };

  const mode = draft.mode ?? "weekly";
  const isWeekly = mode === "weekly";
  const category: ExternalCategory = draft.category ?? "sport";
  const sportOptions: ExternalSport[] = category === "sport" ? SPORT_OPTIONS : EVENT_OPTIONS;

  return (
    <section className={CARD} style={SURFACE_CARD_STYLE}>
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
            Externé aktivity
          </div>
          <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>
            Športy a udalosti (svadba, cestovanie…), s ktorými plán počíta pri generovaní tréningu.
          </div>
        </div>

        <div className="shrink-0">
          <InfoPopover text="Externé športy aj nešportové udalosti, ktoré ovplyvňujú regeneráciu a plánovanie tréningu." />
        </div>
      </div>

      <div className={CARD_BODY_INSET}>
        {!open && (
          <div className={["mt-3", PANEL_PREVIEW].join(" ")} style={{ color: appColors.textMuted }}>
            {previewText}
          </div>
        )}

        {open && (
          <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
            {/* 1. riadok */}
            <div className={FORM_GRID_TWO}>
              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  Typ
                </div>

                <SelectField
                  disabled={!userId || savingDB}
                  value={String(category)}
                  onChange={(e) => {
                    const nextCat = (e.target.value as ExternalCategory) || "sport";
                    const defaultSport = nextCat === "sport" ? SPORT_OPTIONS[0] : EVENT_OPTIONS[0];

                    setDraft((d) => ({
                      ...d,
                      category: nextCat,
                      sport: defaultSport,
                    }));
                  }}
                  options={[
                    { value: "sport", label: "Šport" },
                    { value: "event", label: "Udalosť" },
                  ]}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  Opakovanie
                </div>

                <SelectField
                  disabled={!userId || savingDB}
                  value={String(mode)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      mode: (e.target.value as "weekly" | "single") || "weekly",
                    }))
                  }
                  options={[
                    { value: "weekly", label: "Týždenne" },
                    { value: "single", label: "Jednorazovo" },
                  ]}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  {isWeekly ? "Deň" : "Dátum"}
                </div>

                {isWeekly ? (
                  <SelectField
                    disabled={!userId || savingDB}
                    value={String(draft.day)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        day: (e.target.value as DayAbbrev) || "Mon",
                      }))
                    }
                    options={ALL_DAYS.map((d) => ({ value: d, label: niceLabelForDay(d) }))}
                  />
                ) : (
                // ...v tom mieste kde máš single date:

<DateField
  disabled={!userId || savingDB}
  value={draft.date_single} // už môže byť aj undefined
  onChange={(v) =>
    setDraft((d) => ({
      ...d,
      date_single: v || null,
    }))
  }
/>
                )}
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  {category === "sport" ? "Šport" : "Udalosť"}
                </div>

                <SelectField
                  disabled={!userId || savingDB}
                  value={String(draft.sport)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      sport: (e.target.value as ExternalSport) || "other",
                    }))
                  }
                  options={sportOptions.map((s) => ({ value: s, label: niceLabelForSport(s) }))}
                />
              </section>
            </div>

            {/* 2. riadok */}
            <div className={FORM_GRID_TWO}>
              <section className={SECTION} style={SECTION_STYLE}>
                <TimeField24
                  label="Čas"
                  value={draft.time ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, time: v || null }))}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  Intenzita / záťaž
                </div>

                <SelectField
                  disabled={!userId || savingDB}
                  value={String(draft.intensity)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      intensity: (e.target.value as ExternalIntensity) || "moderate",
                    }))
                  }
                  options={EXT_INTENS.map((i) => ({ value: i, label: niceLabelForIntensity(i) }))}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <TextField
                  label="Poznámka"
                  placeholder="voliteľné"
                  value={draft.note ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      note: (e.target as HTMLInputElement).value,
                    }))
                  }
                  disabled={!userId || savingDB}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAdd} size="sm" variant="success" disabled={!userId || savingDB}>
                    Pridať
                  </Button>

                  <Button size="sm" variant="danger" onClick={handleClearDB} disabled={!userId || savingDB}>
                    Vymazať všetko
                  </Button>
                </div>

                {dbError ? <div className="mt-2 text-[11px] text-red-300">{dbError}</div> : null}
                {dbInfo && !dbError ? <div className="mt-2 text-[11px] text-emerald-300">{dbInfo}</div> : null}
              </section>
            </div>

            {/* LIST */}
            {list.length > 0 && (
              <div className="mt-2">
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  Zoznam
                </div>

                <ul className="mt-2 space-y-2">
                  {list.map((a, idx) => {
                    const when =
                      (a.mode ?? "weekly") === "weekly"
                        ? niceLabelForDay(a.day)
                        : a.date_single || niceLabelForDay(a.day);

                    return (
                      <li
                        key={`${a.day}-${a.sport}-${idx}`}
                        className={[
                          "rounded-xl border border-white/10 bg-white/5",
                          "px-3 py-2 flex items-center justify-between gap-3",
                        ].join(" ")}
                      >
                        <span className="text-sm">
                          {when} · {niceLabelForSport(a.sport)} · {niceLabelForIntensity(a.intensity)}
                          {a.time ? ` · ${a.time}` : ""}
                          {a.note ? ` — ${a.note}` : ""}
                        </span>

                        <Button size="sm" variant="danger" onClick={() => handleRemove(idx)} disabled={savingDB}>
                          odstrániť
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={INPUTS_CARD_FOOTER}>
          {open && (
            <div className={INPUTS_CARD_SAVE_WRAP}>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveToDB}
                disabled={savingDB || !userId}
                className={INPUTS_CARD_SAVE_BTN}
              >
                {savingDB ? "Ukladám…" : "Uložiť do DB"}
              </Button>
            </div>
          )}

          <DisclosureToggle open={open} onToggle={() => setOpen((v) => !v)} className={INPUTS_CARD_TOGGLE} />
        </div>
      </div>
    </section>
  );
}

export default DetailExternalEvents;