"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import type {
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
  ExternalEvent,
} from "@/features/coach/types/externalEvents";
import type { DayAbbrev } from "@/shared/types/day";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import {
  apiGetExternalEvents,
  apiSaveExternalEvents,
} from "@/features/coach/api/coach_external_events";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXT_SPORTS: ExternalSport[] = [
  "football",
  "run",
  "ride",
  "strength",
  "swim",
  "badminton",
  "floorbal",
  "padel",
  "tennis",
  "other",
];
const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];

type Props = {
  userId?: number;
};

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

/* ---------- mapovanie DB ↔️ FE ---------- */

function mapEventsToActivities(events: ExternalEvent[]): ExternalActivity[] {
  return events
    .map<ExternalActivity | null>((ev) => {
      const mode =
        ((ev as any).recurrence_kind as "weekly" | "single" | null) ??
        "weekly";

      let day: DayAbbrev = "Mon";

      if (mode === "weekly") {
        const weekdayNum = Number(
          (ev as any).weekday ?? (ev as any).weekday_int,
        );
        day = INT_TO_DAY[weekdayNum] ?? "Mon";
      } else if (mode === "single") {
        const iso = (ev as any).single_date as string | null;
        if (!iso) return null;
        const dObj = new Date(iso);
        const js = dObj.getDay(); // 0=Sun..6=Sat
        const JS_TO_DAY: DayAbbrev[] = [
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ];
        day = JS_TO_DAY[js] ?? "Mon";
      }

      const sport = ((ev as any).sport as ExternalSport) || "other";

      let intensity: ExternalIntensity = "moderate";
      if ((ev as any).priority === "fixed") intensity = "high";
      if ((ev as any).priority === "optional") intensity = "low";

      const note = (ev as any).notes ?? (ev as any).title ?? undefined;
      const time = (ev as any).start_time_local ?? null;
      const singleDate = (ev as any).single_date ?? null;

      return {
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
  activities: ExternalActivity[],
): ExternalEvent[] {
  return activities.map<ExternalEvent>((a) => {
    const mode = a.mode ?? "weekly";

    // 🔑 DB má weekday NOT NULL → aj pri single vypočítame deň v týždni
    let weekday: number;
    if (mode === "weekly") {
      weekday = DAY_TO_INT[a.day] ?? 1;
    } else {
      // mode === "single"
      if (a.date_single) {
        const d = new Date(a.date_single);
        const js = d.getDay(); // 0..6
        const JS_TO_INT: Record<number, number> = {
          0: 7, // Sun → 7
          1: 1,
          2: 2,
          3: 3,
          4: 4,
          5: 5,
          6: 6,
        };
        weekday = JS_TO_INT[js] ?? 1;
      } else {
        // fallback – ak náhodou nie je date_single, vezmeme day
        weekday = DAY_TO_INT[a.day] ?? 1;
      }
    }

    let priority: "fixed" | "optional" = "optional";
    if (a.intensity === "high") priority = "fixed";

    const titleBase = a.sport;
    const title = a.note ? `${titleBase} – ${a.note}` : titleBase;

    return {
      user_id: userId,
      title,
      sport: a.sport,
      weekday,                         // 🔥 vždy non-null
      recurrence_kind: mode,
      single_date: mode === "single" ? a.date_single ?? null : null,
      start_time_local: a.time ?? null,
      duration_min: null,
      priority,
      notes: a.note ?? null,
      start_date: null,
      end_date: null,
    };
  });
}

/* ---------- komponent ---------- */

export function DetailExternalEvents({ userId }: Props) {
  const [open, setOpen] = useState(true);

  // zdroj pravdy pre externé aktivity
  const [list, setList] = useState<ExternalActivity[]>([]);

  const [extDraft, setExtDraft] = useState<ExternalActivity>({
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

  // načítaj z DB pri zmene userId
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
          e?.message ?? "Nepodarilo sa načítať externé aktivity z DB.",
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
      ...extDraft,
      note: extDraft.note?.trim() || undefined,
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
      const cleaned = list.filter(
        (a) => String(a.sport || "").trim().length > 0,
      );

      console.debug("[EXT] saving activities ->", cleaned);

      const events = mapActivitiesToEvents(userId, cleaned);
      const resp = await apiSaveExternalEvents(userId, events);

      setDbInfo(
        `Uložené do DB (${resp.count} eventov, zmazaných ${resp.deleted}, vložených ${resp.inserted}).`,
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
        `Všetky externé aktivity v DB zmazané (deleted=${resp.deleted}).`,
      );
    } catch (e: any) {
      setDbError(e?.message ?? "Chyba pri mazaní v DB.");
    } finally {
      setSavingDB(false);
    }
  };

  const mode = extDraft.mode ?? "weekly";
  const isWeekly = mode === "weekly";

  const disabled = !userId;

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          External activities & events
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Naplánuj iné športy alebo eventy (napr. futbal, svadba), s ktorými AI počíta pri tvorbe tréningového plánu." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse external activities"
            labelWhenClosed="Expand external activities"
          />
        </div>
      </div>

      {/* Info o DB stave */}
      {userId ? (
        <div className="mb-1 text-[11px] opacity-70">
          {loadingDB
            ? "Načítavam externé aktivity z DB…"
            : "Externé aktivity sa ukladajú do samostatnej tabuľky podľa užívateľa."}
        </div>
      ) : (
        <div className="mb-1 text-[11px] text-red-300">
          Nie si prihlásený – najprv sa prihlás, aby sme vedeli načítať a uložiť eventy.
        </div>
      )}

      {/* Closed preview */}
      {!open && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs select-none"].join(
            " ",
          )}
        >
          {preview.length === 0 ? (
            <span className="opacity-70">
              No external activities — click the arrow to add.
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {preview.map((a, idx) => (
                <span
                  key={`${a.day}-${a.sport}-${a.intensity}-${idx}`}
                  className="px-1.5 py-0.5 rounded border border-white/15/50 bg-white/5 text-[10px] tracking-wide"
                  title={
                    a.note ? a.note : `${a.day} · ${a.sport} · ${a.intensity}`
                  }
                >
                  {a.mode === "single"
                    ? a.date_single ?? a.day
                    : a.day}{" "}
                  · {a.sport} · {a.intensity}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open body */}
      {open && (
        <>
          {/* 1. riadok – režim + deň/dátum + šport + intenzita */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <SelectField
              label="Repeat"
              value={mode}
              onChange={(e) =>
                setExtDraft((d) => ({
                  ...d,
                  mode: e.target.value as "weekly" | "single",
                }))
              }
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "single", label: "Single date" },
              ]}
              disabled={disabled}
            />

            {isWeekly ? (
              <SelectField
                label="Day"
                value={extDraft.day}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    day: e.target.value as DayAbbrev,
                  }))
                }
                options={ALL_DAYS.map((d) => ({ value: d, label: d }))}
                disabled={disabled}
              />
            ) : (
              <TextField
                label="Date"
                type="date"
                value={extDraft.date_single ?? ""}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    date_single: (e.target as HTMLInputElement).value || null,
                  }))
                }
                disabled={disabled}
              />
            )}

            <SelectField
              label="Sport"
              value={extDraft.sport}
              onChange={(e) =>
                setExtDraft((d) => ({
                  ...d,
                  sport: e.target.value as ExternalSport,
                }))
              }
              options={EXT_SPORTS.map((s) => ({ value: s, label: s }))}
              disabled={disabled}
            />

            <SelectField
              label="Intensity"
              value={extDraft.intensity}
              onChange={(e) =>
                setExtDraft((d) => ({
                  ...d,
                  intensity: e.target.value as ExternalIntensity,
                }))
              }
              options={EXT_INTENS.map((i) => ({ value: i, label: i }))}
              disabled={disabled}
            />
          </div>

          {/* 2. riadok – čas + poznámka */}
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <TextField
              label="Time"
              type="time"
              value={extDraft.time ?? ""}
              onChange={(e) =>
                setExtDraft((d) => ({
                  ...d,
                  time: (e.target as HTMLInputElement).value || null,
                }))
              }
              disabled={disabled}
            />
            <TextField
              label="Note"
              placeholder="optional"
              value={extDraft.note ?? ""}
              onChange={(e) =>
                setExtDraft((d) => ({
                  ...d,
                  note: (e.target as HTMLInputElement).value,
                }))
              }
              disabled={disabled}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              onClick={handleAdd}
              size="sm"
              variant="success"
              disabled={disabled}
            >
              Add external
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={handleSaveToDB}
              disabled={disabled || savingDB}
            >
              {savingDB ? "Saving to DB…" : "Uložiť do DB"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleClearDB}
              disabled={disabled || savingDB}
            >
              Vymazať všetky v DB
            </Button>
          </div>

          {list.length > 0 && (
            <ul className="mt-3 space-y-2">
              {list.map((a, idx) => (
                <li
                  key={`${idx}-${a.sport}-${a.mode}-${a.date_single ?? a.day}`}
                  className={[
                    SURFACE_INLINE,
                    "px-3 py-2 flex items-center justify-between",
                  ].join(" ")}
                >
                  <span className="text-sm">
                    {(a.mode ?? "weekly") === "weekly"
                      ? `${a.day}`
                      : a.date_single || a.day}{" "}
                    · {a.sport} · {a.intensity}
                    {a.time ? ` · ${a.time}` : ""}
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(idx)}
                    disabled={disabled}
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
      )}
    </section>
  );
}