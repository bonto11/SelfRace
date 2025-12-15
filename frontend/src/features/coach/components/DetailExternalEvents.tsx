"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/shared/components/ui/Button";
import SelectField from "@/shared/components/ui/SelectField";
import TextField from "@/shared/components/ui/TextField";
import DateField from "@/shared/components/ui/DateField";
import TimeField24 from "@/shared/components/ui/TimeField24";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";

import type { DayAbbrev } from "@/shared/types/day";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

import {
  apiGetExternalEvents,
  apiSaveExternalEvents,
} from "@/features/coach/api/coach_external_events";

import type {
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
  ExternalEvent,
  ExternalCategory,
} from "@/features/coach/types/externalEvents";

type Props = {
  userId?: number;
};

/* ---------- constants ---------- */

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** športové aktivity */
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

/** eventy / životné veci – zosúladené s tvojím ExternalSport unionom */
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

const JS_TO_DAY: DayAbbrev[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/* ---------- helpers ---------- */

function detectCategory(sport: ExternalSport | null): ExternalCategory {
  if (!sport) return "sport";
  if (EVENT_OPTIONS.includes(sport)) return "event";
  return "sport";
}

function niceLabelForSport(s: ExternalSport): string {
  switch (s) {
    case "run":
      return "Run";
    case "ride":
      return "Ride";
    case "strength":
      return "Strength";
    case "swim":
      return "Swim";
    case "football":
      return "Football";
    case "badminton":
      return "Badminton";
    case "floorbal":
      return "Floorball";
    case "padel":
      return "Padel";
    case "tennis":
      return "Tennis";
    case "other":
      return "Other sport";
    case "wedding":
      return "Wedding";
    case "travel":
      return "Travel";
    case "party":
      return "Party";
    case "work":
      return "Work event";
    case "family":
      return "Family event";
    case "other_event":
      return "Other event";
    default:
      return String(s);
  }
}

/* ---------- mapovanie DB ↔ FE ---------- */

function mapEventsToActivities(events: ExternalEvent[]): ExternalActivity[] {
  return events
    .map<ExternalActivity | null>((ev) => {
      const mode = (ev.recurrence_kind as "weekly" | "single") ?? "weekly";

      let day: DayAbbrev = "Mon";

      if (mode === "weekly") {
        const weekdayNum = Number(
          (ev as any).weekday ?? (ev as any).weekday_int
        );
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

function mapActivitiesToEvents(
  userId: number,
  activities: ExternalActivity[]
): ExternalEvent[] {
  return activities.map<ExternalEvent>((a) => {
    const mode = a.mode ?? "weekly";
    const weekday = mode === "weekly" ? DAY_TO_INT[a.day] ?? 1 : 1; // BE vyžaduje 1–7

    let priority: "fixed" | "optional" = "optional";
    if (a.intensity === "high") priority = "fixed";

    const baseTitle = niceLabelForSport(a.sport);
    const title = a.note ? `${baseTitle} – ${a.note}` : baseTitle;

    return {
      id: 0 as any, // BE si vygeneruje svoje
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
  const [open, setOpen] = useState(true);

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

  // načítanie z DB
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

        const activities = mapEventsToActivities(events ?? []);
        setList(activities);
      } catch (e: any) {
        if (!alive) return;
        setDbError(
          e?.message ?? "Nepodarilo sa načítať externé aktivity z DB."
        );
      } finally {
        if (!alive) return;
        setLoadingDB(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const preview = useMemo(() => {
    const order = Object.fromEntries(ALL_DAYS.map((d, i) => [d, i]));
    return [...list].sort((a, b) => {
      const d = (order[a.day] ?? 0) - (order[b.day] ?? 0);
      if (d !== 0) return d;
      const s = a.sport.localeCompare(b.sport);
      if (s !== 0) return s;
      return a.intensity.localeCompare(b.intensity);
    });
  }, [list]);

  const handleAdd = () => {
    const next: ExternalActivity = {
      ...draft,
      note: draft.note?.trim() || undefined,
    };
    setList((cur) => [...cur, next]);
  };

  const handleRemove = (idx: number) => {
    setList((cur) => cur.filter((_, i) => i !== idx));
  };

  const handleSaveToDB = async () => {
    if (!userId) return;
    setSavingDB(true);
    setDbError(null);
    setDbInfo(null);
    try {
      const cleaned = list.filter((a) => String(a.sport || "").trim().length);
      const events = mapActivitiesToEvents(userId, cleaned);
      const resp = await apiSaveExternalEvents(userId, events);

      setDbInfo(
        `Uložené do DB (${resp.count} eventov, zmazaných ${resp.deleted}, vložených ${resp.inserted}).`
      );
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
      setDbInfo(
        `Všetky externé aktivity v DB zmazané (deleted=${resp.deleted}).`
      );
    } catch (e: any) {
      setDbError(e?.message ?? "Chyba pri mazaní v DB.");
    } finally {
      setSavingDB(false);
    }
  };

  const mode = draft.mode ?? "weekly";
  const isWeekly = mode === "weekly";
  const category: ExternalCategory = draft.category ?? "sport";

  const sportOptions: ExternalSport[] =
    category === "sport" ? SPORT_OPTIONS : EVENT_OPTIONS;

  return (
    <section className={SECTION}>
      {/* Header – bez toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          External activities & events
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Externé športy aj nešportové udalosti (svadba, cestovanie…), s ktorými plán počíta pri generovaní tréningu." />
        </div>
      </div>

      {/* keď nie si prihlásený, rieši to panel (nie page) */}
      {!userId && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-sm opacity-80"].join(" ")}
        >
          Najprv sa prosím prihlás, aby sme vedeli načítať a uložiť externé
          eventy.
        </div>
      )}

      {/* DB info len keď userId existuje */}
      {userId && (
        <div className="mb-2 text-[11px] opacity-70">
          {loadingDB
            ? "Načítavam externé aktivity z DB…"
            : "Externé aktivity sa ukladajú do samostatnej tabuľky podľa užívateľa."}
        </div>
      )}

      {/* === tu nechaj tvoje form polia + zoznam + save/clear DB presne ako máš === */}
      {/* (tvoj existujúci “Open body” obsah ide sem BEZ podmienky open) */}

      {/* Open body */}
      {
        <>
          {/* 1. riadok – typ, repeat, deň/dátum, sport/event */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <SelectField
              label="Type"
              value={category}
              onChange={(e) => {
                const nextCat = e.target.value as ExternalCategory;
                const defaultSport =
                  nextCat === "sport" ? SPORT_OPTIONS[0] : EVENT_OPTIONS[0];

                setDraft((d) => ({
                  ...d,
                  category: nextCat,
                  sport: defaultSport,
                }));
              }}
              options={[
                { value: "sport", label: "Sport" },
                { value: "event", label: "Event" },
              ]}
            />

            <SelectField
              label="Repeat"
              value={mode}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  mode: e.target.value as "weekly" | "single",
                }))
              }
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "single", label: "Single date" },
              ]}
            />

            {isWeekly ? (
              <SelectField
                label="Day"
                value={draft.day}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    day: e.target.value as DayAbbrev,
                  }))
                }
                options={ALL_DAYS.map((d) => ({ value: d, label: d }))}
              />
            ) : (
              <DateField
                label="Date"
                value={draft.date_single ?? ""}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    date_single: v || null,
                  }))
                }
              />
            )}

            <SelectField
              label={category === "sport" ? "Sport" : "Event"}
              value={draft.sport}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  sport: e.target.value as ExternalSport,
                }))
              }
              options={sportOptions.map((s) => ({
                value: s,
                label: niceLabelForSport(s),
              }))}
            />
          </div>

          {/* 2. riadok – čas, load, poznámka */}
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <TimeField24
              label="Time"
              value={draft.time ?? ""}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  time: v || null,
                }))
              }
            />

            <SelectField
              label="Intensity / load"
              value={draft.intensity}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  intensity: e.target.value as ExternalIntensity,
                }))
              }
              options={EXT_INTENS.map((i) => ({ value: i, label: i }))}
            />

            <TextField
              label="Note"
              placeholder="optional"
              value={draft.note ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  note: (e.target as HTMLInputElement).value,
                }))
              }
            />
          </div>

          {/* akcie */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handleAdd} size="sm" variant="success">
              Add external
            </Button>

            {userId && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveToDB}
                  disabled={savingDB}
                >
                  {savingDB ? "Saving to DB…" : "Uložiť do DB"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleClearDB}
                  disabled={savingDB}
                >
                  Vymazať všetky v DB
                </Button>
              </>
            )}
          </div>

          {list.length > 0 && (
            <ul className="mt-3 space-y-2">
              {list.map((a, idx) => (
                <li
                  key={`${a.day}-${a.sport}-${idx}`}
                  className={[
                    SURFACE_INLINE,
                    "px-3 py-2 flex items-center justify-between",
                  ].join(" ")}
                >
                  <span className="text-sm">
                    {(a.mode ?? "weekly") === "weekly"
                      ? a.day
                      : a.date_single || a.day}
                    {" · "}
                    {niceLabelForSport(a.sport)} · {a.intensity}
                    {a.time ? ` · ${a.time}` : ""}
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(idx)}
                  >
                    remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {dbError && (
            <div className="mt-2 text-[11px] text-red-300">{dbError}</div>
          )}
          {dbInfo && !dbError && (
            <div className="mt-2 text-[11px] text-emerald-300">{dbInfo}</div>
          )}
        </>
      }
    </section>
  );
}

export default DetailExternalEvents;
