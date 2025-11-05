"use client";

import { useMemo } from "react";
import {
  DAY_ORDER,
  type DailyPlan,
  detectSport,
  dateFromWeekStart, // môžeš ho nechať pre iné miesta; tu si rátame ISO
  getItemLabel,
} from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ===== helpers ===== */

/** Mapovanie dňa na offset (Po=0 ... Ne=6) podľa tvojho DAY_ORDER */
const DAY_OFFSET: Record<(typeof DAY_ORDER)[number], number> = {
  Po: 0, Ut: 1, St: 2, Št: 3, Pi: 4, So: 5, Ne: 6,
};

/** yyyy-mm-dd -> Date (bez časovej zóny riešime jednoducho) */
function parseIsoDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 12, 0, 0)); // „poludnie“ minimalizuje TZ hrany
  return dt;
}

/** Date -> yyyy-mm-dd */
function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Spočíta ISO dátum pre daný plan day (Po..Ne) z weekStart ISO (Po) */
function isoFromWeekStart(weekStartIso: string | undefined, day: (typeof DAY_ORDER)[number]): string | null {
  if (!weekStartIso) return null;
  const base = parseIsoDate(weekStartIso);
  if (!base) return null;
  const off = DAY_OFFSET[day] ?? 0;
  const d = new Date(base);
  d.setUTCDate(base.getUTCDate() + off);
  return toIso(d);
}

/* ===== typ pre interný row ===== */
type Row = {
  id: string;
  day: (typeof DAY_ORDER)[number];
  dateIso: string | null;
  sport: "run" | "ride" | "strength" | "other" | "mixed";
  title: string;
  focus?: string | null;
  dur: string;
  intensity: string;
  target: string;
  notes: string;
  structure: any;
};

export default function PlanCards({
  daily,
  weekStart,
}: {
  daily: DailyPlan[];
  weekStart?: string;
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    daily.forEach(({ day, items }) => {
      // aj prázdny deň zobrazíme (—)
      if (!items?.length) {
        out.push({
          id: `${day}-empty`,
          day,
          dateIso: isoFromWeekStart(weekStart, day),
          sport: "other",
          title: "—",
          focus: null,
          dur: "",
          intensity: "",
          target: "",
          notes: "",
          structure: null,
        });
        return;
      }
      items.forEach((it, idx) => {
        const { title, dur, intensity, target, notes } = getItemLabel(it as any);
        out.push({
          id: `${day}-${idx}`,
          day,
          dateIso: isoFromWeekStart(weekStart, day),
          sport: detectSport(it) as Row["sport"],
          title,
          focus: (it as any).focus ?? null,
          dur: dur != null ? `${dur} min` : "",
          intensity: intensity ?? "",
          target: target ?? "",
          notes: notes ?? "",
          structure: (it as any).structure ?? null,
        });
      });
    });
    return out;
  }, [daily, weekStart]);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        // sekundárna meta pre „plan“ rieši priamo ActivitySingle (variant "plan")
        const renderDetail = r.structure
          ? () => (
              <div>
                {/* Poznámka od coacha (ak je) */}
                {r.notes ? (
                  <div className="mb-2 text-sm opacity-80">{r.notes}</div>
                ) : null}
                <PlanCardDetail s={r.structure} />
              </div>
            )
          : undefined;

        return (
          <ActivitySingle
            key={r.id}
            variant="plan"
            data={{
              id: r.id,
              name: r.title,               // hlavný text (rovnako ako „activity“)
              dateIso: r.dateIso ?? undefined, // v headri vľavo (deň + dátum si ActivitySingle predžuje z dateIso)
              sport: r.sport,
              // sekundárny riadok sa skladá vo vnútri ActivitySingle(variant plan) z planDur/intensity/target
              planDur: r.dur || null,
              planIntensity: r.intensity || null,
              planTarget: r.target || null,
              // voliteľne posielame aj poznámku (zobrazí sa v detaile)
              planNotes: r.notes || null,
            }}
            defaultOpen={false}
            renderDetail={renderDetail}
          />
        );
      })}
    </div>
  );
}