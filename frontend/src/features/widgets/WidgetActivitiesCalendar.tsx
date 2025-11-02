// src/features/widgets/WidgetWeekActivities.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";

const SPORT_COLORS: Record<string, string> = {
  run:      (THEME as any)?.sport?.run ?? THEME.chart.run,
  ride:     (THEME as any)?.sport?.ride ?? THEME.chart.ride,
  swim:     (THEME as any)?.sport?.swim ?? THEME.chart.swim,
  strength: (THEME as any)?.sport?.strength ?? THEME.chart.strength,
  mixed:    (THEME as any)?.sport?.mixed ?? THEME.chart.mixed,
  skate:    (THEME as any)?.sport?.skate ?? THEME.chart.skate,
  walk:     (THEME as any)?.sport?.walk ?? THEME.chart.walk,
  other:    (THEME as any)?.sport?.other ?? THEME.chart.other,
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

/** pondelok aktuálneho týždňa (lokálne) */
function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Po=0..Ne=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

type Props = {
  /** volá sa po kliknutí na widget → detail */
  onOpenDetail?: () => void;
  /** max počet zobrazených aktivít na deň (zvyšok sa skráti '+N') */
  perDayLimit?: number;
};

export default function WidgetWeekActivities({ onOpenDetail, perDayLimit = 3 }: Props) {
  const router = useRouter();
  const { selectByRange } = useActivityData();

  // týždeň Po–Ne
  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = iso(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const endIso   = iso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  // načítaj aktivity v rozsahu a rozdeľ po dňoch
  const byDay = React.useMemo(() => {
    const map = new Map<string, { id: number; sport: string; name: string }[]>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(k, []);
    }
    const rows = selectByRange(startIso, endIso);
    for (const r of rows) {
      const k = r.date.slice(0, 10);
      if (!map.has(k)) continue;
      (map.get(k) as any[]).push({
        id: r.activity_id,
        sport: (r as any).sport || "other",
        name: r.name || "",
      });
    }
    return map;
  }, [selectByRange, startIso, endIso]);

  const weekLabel = `${monday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })} – ${sunday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })}`;

  const handleOpen = () => {
    if (onOpenDetail) onOpenDetail();
    else router.push("/calendar");
  };

  return (
    <WidgetCard
      title={`Týždenná agenda • ${weekLabel}`}
      onOpen={handleOpen}
      interactive
      accent="bg-slate-700"
      minH={180}
    >
      {/* hlavička dní */}
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2">
        {["Po","Ut","St","Št","Pi","So","Ne"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* 7 stĺpcov s aktivitami */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const items = byDay.get(key) ?? [];
          const shown = items.slice(0, perDayLimit);
          const extra = items.length - shown.length;

          const isToday = new Date().toDateString() === d.toDateString();

          return (
            <button
              key={key}
              onClick={handleOpen}
              className={[
                "group text-left rounded-2xl p-2 border border-white/10",
                "bg-white/5 dark:bg-black/20 hover:bg-white/10 transition-colors",
                isToday ? "ring-2 ring-emerald-500/60" : "",
              ].join(" ")}
              aria-label={key}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={[
                    "h-7 w-7 rounded-full grid place-items-center text-sm font-semibold",
                    "bg-white/10 group-hover:bg-white/20",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                {/* malé bodky = počty športov v daný deň */}
                <div className="flex items-center gap-1">
                  {shown.map((it) => (
                    <span
                      key={it.id}
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
                    />
                  ))}
                  {extra > 0 && (
                    <span className="text-[10px] opacity-70">+{extra}</span>
                  )}
                </div>
              </div>

              {/* názvy (orezané) */}
              <ul className="space-y-1">
                {shown.map((it) => (
                  <li
                    key={`${it.id}-name`}
                    className="flex items-center gap-2 text-xs opacity-85 truncate"
                    title={it.name}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mt-0.5"
                      style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
                    />
                    <span className="truncate">{it.name || "—"}</span>
                  </li>
                ))}
                {extra > 0 && (
                  <li className="text-[11px] opacity-60">+{extra} ďalších…</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] opacity-60">
        Tip: Klikni na widget pre mesačný kalendár a detailnejšiu prácu.
      </div>
    </WidgetCard>
  );
}