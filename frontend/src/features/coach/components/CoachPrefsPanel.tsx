// src/features/coach/components/CoachPrefsPanel.tsx
"use client";

import { useMemo } from "react";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";

type Day = "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun";

const DAY_LABEL: Record<Day, string> = {
  Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun",
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-700/70 text-xs">
    {children}
  </span>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid sm:grid-cols-[220px_1fr] gap-2 items-start">
    <div className="opacity-70 text-sm">{label}</div>
    <div className="text-sm">{children}</div>
  </div>
);

export default function CoachPrefsPanel() {
  const { prefs } = useCoachData();

  const sports = useMemo(
    () => prefs.primary_sports ?? prefs.sports ?? [],
    [prefs.primary_sports, prefs.sports]
  );

  const p = prefs.preferences;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-6">
      <h2 className="text-lg font-semibold">Preferences — detail</h2>

      {/* ---- PREHĽAD ---- */}
      <section className="space-y-2">
        <Row label="Goal kind">
          <span className="font-medium">{prefs.goal_kind ?? "—"}</span>
        </Row>

        <Row label="Goal text (override)">
          <span className="block">{prefs.goal_text_override ?? "—"}</span>
        </Row>

        <Row label="Weeks">
          <span className="font-medium">{prefs.weeks ?? "—"}</span>
        </Row>

        <Row label="Sports">
          {sports.length ? (
            <div className="flex flex-wrap gap-1">
              {sports.map((s) => <Chip key={s}>{s}</Chip>)}
            </div>
          ) : "—"}
        </Row>
      </section>

      {/* ---- RUN TARGETS ---- */}
      <section className="space-y-2">
        <h3 className="font-semibold">Running — targets</h3>
        <Row label="Race goal">
          {prefs.targets?.run?.race_goal ?? "—"}
        </Row>
        <Row label="Current best time">
          {prefs.targets?.run?.current_best_time ?? "—"}
        </Row>
        <Row label="Target time">
          {prefs.targets?.run?.target_time ?? "—"}
        </Row>
        <Row label="Longest recent distance">
          {prefs.targets?.run?.longest_recent_distance_km != null
            ? `${prefs.targets.run.longest_recent_distance_km} km`
            : "—"}
        </Row>
      </section>

      {/* ---- RIDE TARGETS ---- */}
      <section className="space-y-2">
        <h3 className="font-semibold">Cycling — targets</h3>
        <Row label="Focus">
          {prefs.targets?.ride?.focus ?? "—"}
        </Row>
        <Row label="Weekly time target">
          {prefs.targets?.ride?.weekly_time_target_min != null
            ? `${prefs.targets.ride.weekly_time_target_min} min`
            : "—"}
        </Row>
      </section>

      {/* ---- STRENGTH TARGETS ---- */}
      <section className="space-y-2">
        <h3 className="font-semibold">Strength — targets</h3>
        <Row label="Focus">
          {prefs.targets?.strength?.focus ?? "—"}
        </Row>
        <Row label="Sessions per week">
          {prefs.targets?.strength?.sessions_per_week ?? "—"}
        </Row>
      </section>

      {/* ---- PLÁNOVANIE / PREFERENCIE ---- */}
      <section className="space-y-2">
        <h3 className="font-semibold">Planning preferences</h3>

        <Row label="Days off">
          {p?.days_off?.length ? (
            <div className="flex flex-wrap gap-1">
              {p.days_off.map((d: Day, i) => <Chip key={`${d}-${i}`}>{DAY_LABEL[d]}</Chip>)}
            </div>
          ) : "—"}
        </Row>

        <Row label="Preferred long-run days">
          {p?.long_run_days?.length ? (
            <div className="flex flex-wrap gap-1">
              {p.long_run_days.map((d: Day, i) => <Chip key={`${d}-${i}`}>{DAY_LABEL[d]}</Chip>)}
            </div>
          ) : "—"}
        </Row>

        <Row label="Avoid back-to-back hard">
          <strong>{p?.avoid_back_to_back_hard ? "Yes" : "No"}</strong>
        </Row>

        <Row label="Use zones">
          <strong>{p?.use_zones ? "Yes" : "No"}</strong>
        </Row>

        <Row label="WU/CD detail">
          <strong>{p?.wu_cd_detail ? "Yes" : "No"}</strong>
        </Row>
      </section>

      {/* ---- LEGACY / TEXTOVÉ POZNÁMKY ---- */}
      <section className="space-y-2">
        <h3 className="font-semibold">Notes</h3>
        <div className="text-sm">{prefs.notes ?? "—"}</div>
      </section>

      {/* hint na budúci editor */}
      <p className="text-xs opacity-70">
        (Neskôr sem pôjde editačný formulár + ukladanie cez <code>savePrefs()</code>.)
      </p>
    </div>
  );
}