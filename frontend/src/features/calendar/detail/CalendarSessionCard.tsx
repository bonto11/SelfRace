// src/features/calendar/detail/CalendarSessionCard.tsx
"use client";

import * as React from "react";
import { SURFACE_CARD, SURFACE_INLINE, FLUSH_DETAIL } from "@/shared/ui/classes";
import SportBadge from "@/shared/components/ui/SportBadge";
import HrChart from "@/shared/components/trend/HrChart";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { fmtDistance, fmtSecondsHMS } from "@/shared/utils/format";
import type { UnifiedSession } from "@/features/calendar/detail/unifiedSession";

function statusLabel(s?: string) {
  if (s === "done") return "hotovo";
  if (s === "missed") return "missed";
  return "planned";
}
function statusCls(s?: string) {
  if (s === "done") return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (s === "missed") return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

export default function CalendarSessionCard({
  item,
  defaultOpen = false,
  showDebugJson = true,
}: {
  item: UnifiedSession;
  defaultOpen?: boolean;
  showDebugJson?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className={[SURFACE_CARD, "overflow-hidden", "px-5 py-4"].join(" ")}>
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm truncate">{item.title}</span>

            {item.status && (
              <span
                className={[
                  "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                  statusCls(item.status),
                ].join(" ")}
              >
                {statusLabel(item.status)}
              </span>
            )}
          </div>

          {item.subtitle && (
            <div className="text-sm mt-1 opacity-80">{item.subtitle}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SportBadge sport={item.sport} />
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            title={open ? "Skryť detail" : "Otvoriť detail"}
            className="h-8 w-8 grid place-items-center rounded-full border border-white/10 bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span className={["text-base leading-none select-none transition-transform", open ? "rotate-180" : ""].join(" ")}>
              ▾
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className={FLUSH_DETAIL}>
          <CardDetail item={item} showDebugJson={showDebugJson} />
        </div>
      )}
    </section>
  );
}

function CardDetail({ item, showDebugJson }: { item: UnifiedSession; showDebugJson: boolean }) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  // KPI chips
  const kpis = Array.isArray(item.kpis) ? item.kpis : [];
  const hasKpis = kpis.length > 0;

  // activity extra (hr/splits/laps)
  const [streams, setStreams] = React.useState<{ time_s: number[]; hr: (number | null)[]; duration_s: number }>({
    time_s: [],
    hr: [],
    duration_s: 0,
  });
  const [laps, setLaps] = React.useState<any[]>([]);
  const [splits, setSplits] = React.useState<any[]>([]);

  React.useEffect(() => {
    let alive = true;
    if (item.kind !== "activity" || item.activityId == null) return;

    (async () => {
      try {
        const st = await getStreams(item.activityId!);
        const dt = await getDetail(item.activityId!);
        if (!alive) return;
        if (st) setStreams(st as any);
        setLaps((dt as any)?.laps || []);
        setSplits((dt as any)?.splits || []);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [item.kind, item.activityId, getStreams, getDetail]);

  // pre activity doplň aj KPI z summary keď niečo chýba
  const summary = React.useMemo(() => {
    if (item.kind !== "activity" || item.activityId == null) return null;
    return getSummary(item.activityId) as any | null;
  }, [item.kind, item.activityId, getSummary]);

  const distTxt = summary ? fmtDistance(summary.distance_m ?? null) : null;
  const timeTxt = summary?.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : null;

  return (
    <div>
      {hasKpis && (
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-[10px] opacity-70">{k.label}</div>
              <div className="text-xl font-semibold tabular-nums">{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* notes */}
      {item.notes && <div className="mt-3 text-sm opacity-90">{item.notes}</div>}

      {/* activity-only */}
      {item.kind === "activity" && (
        <>
          {(timeTxt || distTxt) && (
            <div className="mt-3 text-xs opacity-80">
              {[timeTxt ? `Time ${timeTxt}` : null, distTxt ? `Distance ${distTxt}` : null].filter(Boolean).join(" · ")}
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold">HR priebeh</h4>
            </div>
            {streams.time_s.length ? (
              <HrChart xs={streams.time_s} ys={streams.hr} height={148} compact />
            ) : (
              <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
            )}
          </div>

          {!!splits.length && (
            <>
              <h4 className="font-bold mt-3">Splits</h4>
              <ul className="list-disc pl-5">
                {splits.map((sp: any, idx: number) => (
                  <li key={sp.split_index ?? idx}>
                    Split {sp.split_index ?? idx}: {fmtDistance(sp.distance_m)}, {fmtSecondsHMS(sp.moving_time_s)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {!!laps.length && (
            <>
              <h4 className="font-bold mt-3">Laps</h4>
              <ul className="list-disc pl-5">
                {laps.map((lap: any, idx: number) => (
                  <li key={lap.lap_index ?? idx}>
                    Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)}, {fmtSecondsHMS(lap.moving_time_s)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* debug dump (dočasne) */}
      {showDebugJson && (
        <details className="mt-4">
          <summary className="text-xs opacity-70 cursor-pointer">Debug JSON</summary>
          <pre className="mt-2 text-[11px] opacity-90 whitespace-pre-wrap break-words">
            {JSON.stringify(item.raw ?? item, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}