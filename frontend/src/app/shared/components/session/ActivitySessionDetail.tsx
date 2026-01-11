"use client";

import { useEffect, useState } from "react";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { formatDistance } from "@/app/shared/utils/distance";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import {
  ActivityRow,
  ComponentVariant,
  StreamsData,
} from "@/app/features/activities/types/activities";
import { ActivityStreamCharts } from "@/app/shared/components/trend/StreamCharts";
import { ActivityRouteMap } from "@/app/shared/components/trend/ActivityRouteMap";

import { MetricGrid } from "./MetricGrid";
import DetailSection from "./DetailSection";
import {
  formatCadenceSummary,
  valOrDash,
  workoutTypeLabelFromSummary,
} from "./sessionUtils";

import type { ActivitySession } from "./SessionCard";

type Props = {
  variant: ComponentVariant;
  item: ActivitySession;
  compactChart: boolean;
  onOpenActivity?: (activityId: number) => void;
};

export default function ActivitySessionDetail({
  item,
  compactChart,
  onOpenActivity,
}: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();

  const kpis = Array.isArray(item.kpis) ? item.kpis : [];

  const s: ActivityRow | null =
    item.activityId != null ? ((getSummary(item.activityId) as any) || null) : null;

  const distTxt = s
    ? formatDistance(s.distance_m ?? null)
    : item.distanceStr ?? "—";
  const timeTxt =
    s && s.moving_time_s != null
      ? fmtSecondsHMS(s.moving_time_s)
      : item.timeStr ?? "—";
  const avgTxt = s ? s.average_heartrate_bpm ?? "—" : item.avgHr ?? "—";
  const maxTxt = s ? s.max_heartrate_bpm ?? "—" : item.maxHr ?? "—";

  const [streams, setStreams] = useState<StreamsData>({
    time_s: [],
    hr: [],
    duration_s: 0,
    cadence_rpm: [],
    power_w: [],
    distance_m: [],
    altitude_m: [],
  });
  const [routePoints, setRoutePoints] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    if (!item.activityId) return;

    (async () => {
      try {
        const st = await getStreams(item.activityId);
        const dt = await getDetail(item.activityId);

        if (!alive) return;

        if (st) {
          const raw: any = st ?? {};

          const time_s: number[] = Array.isArray(raw.time_s)
            ? raw.time_s
            : Array.isArray(raw.time)
            ? raw.time
            : [];

          const hr: (number | null)[] = Array.isArray(raw.hr)
            ? raw.hr
            : Array.isArray(raw.heartrate_bpm)
            ? raw.heartrate_bpm
            : [];

          const cadence_rpm: (number | null)[] =
            Array.isArray(raw.cadence_rpm) && raw.cadence_rpm.length
              ? raw.cadence_rpm
              : Array.isArray(raw.cadence)
              ? raw.cadence
              : [];

          const power_w: (number | null)[] =
            Array.isArray(raw.power_w) && raw.power_w.length
              ? raw.power_w
              : Array.isArray(raw.watts)
              ? raw.watts
              : [];

          const distance_m: (number | null)[] =
            Array.isArray(raw.distance_m) && raw.distance_m.length
              ? raw.distance_m
              : Array.isArray(raw.distance)
              ? raw.distance
              : [];

          const altitude_m: (number | null)[] =
            Array.isArray(raw.altitude_m) && raw.altitude_m.length
              ? raw.altitude_m
              : Array.isArray(raw.altitude)
              ? raw.altitude
              : [];

          const duration_s: number =
            typeof raw.duration_s === "number"
              ? raw.duration_s
              : time_s.length
              ? Number(time_s[time_s.length - 1]) || 0
              : 0;

          const pts: { lat: number; lng: number }[] = [];
          const latlngRaw = raw.latlng;

          if (Array.isArray(latlngRaw)) {
            for (const p of latlngRaw) {
              if (
                Array.isArray(p) &&
                p.length >= 2 &&
                typeof p[0] === "number" &&
                typeof p[1] === "number"
              ) {
                pts.push({ lat: p[0], lng: p[1] });
              } else if (
                p &&
                typeof p.lat === "number" &&
                typeof p.lng === "number"
              ) {
                pts.push({ lat: p.lat, lng: p.lng });
              }
            }
          }

          setStreams({
            time_s,
            hr,
            duration_s,
            cadence_rpm,
            power_w,
            distance_m,
            altitude_m,
          });
          setRoutePoints(pts);
        } else {
          setStreams({
            time_s: [],
            hr: [],
            duration_s: 0,
            cadence_rpm: [],
            power_w: [],
            distance_m: [],
            altitude_m: [],
          });
          setRoutePoints([]);
        }

        if (dt) {
          const anyDt: any = dt;
          setLaps(anyDt.laps || []);
          setSplits(anyDt.splits || []);
        }
      } catch (err) {
        console.error("[ActivitySessionDetail] getStreams/getDetail error", err);
        setStreams({
          time_s: [],
          hr: [],
          duration_s: 0,
          cadence_rpm: [],
          power_w: [],
          distance_m: [],
          altitude_m: [],
        });
        setRoutePoints([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [item.activityId, getStreams, getDetail]);

  return (
    <div>
      {/* PREHĽAD / ZÁKLADNÉ ÚDAJE */}
      {kpis.length > 0 ? (
        <DetailSection title="Prehľad">
          <MetricGrid
            metrics={kpis.map((k) => ({
              label: k.label,
              value: k.value,
            }))}
          />
        </DetailSection>
      ) : (
        <DetailSection title="Základné údaje">
          <MetricGrid
            metrics={[
              { label: "TIME", value: timeTxt },
              { label: "DISTANCE", value: distTxt },
              { label: "AVG HR", value: avgTxt },
              { label: "MAX HR", value: maxTxt },
            ]}
          />
        </DetailSection>
      )}

      {/* ĎALŠIE METRIKY zo summary */}
      {s && (
        <>
          <DetailSection title="Elevácia & kadencia">
            <MetricGrid
              metrics={[
                {
                  label: "ELEV GAIN",
                  value:
                    s.elevation_gain_m != null
                      ? `${s.elevation_gain_m} m`
                      : "—",
                },
                {
                  label: "ELEV HIGH",
                  value:
                    s.elev_high_m != null ? `${s.elev_high_m} m` : "—",
                },
                {
                  label: "ELEV LOW",
                  value:
                    s.elev_low_m != null ? `${s.elev_low_m} m` : "—",
                },
                {
                  label: "AVG CADENCE",
                  value: formatCadenceSummary(s) ?? "—",
                },
              ]}
            />
          </DetailSection>

          <DetailSection title="Rýchlosť & výkon">
            <MetricGrid
              metrics={[
                {
                  label: "AVG SPEED",
                  value:
                    s.average_speed_mps != null
                      ? `${s.average_speed_mps.toFixed(3)} m/s`
                      : "—",
                },
                {
                  label: "MAX SPEED",
                  value:
                    s.max_speed_mps != null
                      ? `${s.max_speed_mps.toFixed(3)} m/s`
                      : "—",
                },
                {
                  label: "AVG POWER",
                  value:
                    s.average_watts != null ? `${s.average_watts} W` : "—",
                },
                {
                  label: "MAX POWER",
                  value: s.max_watts != null ? `${s.max_watts} W` : "—",
                },
              ]}
            />
          </DetailSection>

          <DetailSection title="Prostredie & štatistiky">
            <MetricGrid
              metrics={[
                {
                  label: "AVG TEMP",
                  value:
                    s.average_temp_c != null
                      ? `${s.average_temp_c} °C`
                      : "—",
                },
                {
                  label: "CALORIES",
                  value:
                    s.calories_kcal != null
                      ? `${s.calories_kcal} kcal`
                      : "—",
                },
                {
                  label: "ACHIEVEMENTS",
                  value: valOrDash(s.achievement_count),
                },
                {
                  label: "PR COUNT",
                  value: valOrDash(s.pr_count),
                },
              ]}
            />
          </DetailSection>

          <DetailSection title="Typ tréningu">
            <MetricGrid
              cols={2}
              metrics={[
                {
                  label: "WORKOUT TYPE",
                  value: workoutTypeLabelFromSummary(s) ?? "—",
                },
              ]}
            />
          </DetailSection>
        </>
      )}

      {/* Akcie na activitu */}
      {(item.onEdit || item.onDelete || item.onToggleFavorite) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.onToggleFavorite && (
            <button
              type="button"
              onClick={item.onToggleFavorite}
              className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
            >
              {item.isFavorite ? "★ Favorite" : "☆ Set favorite"}
            </button>
          )}
          {item.onEdit && (
            <button
              type="button"
              onClick={item.onEdit}
              className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
            >
              Edit
            </button>
          )}
          {item.onDelete && (
            <button
              type="button"
              onClick={item.onDelete}
              className="h-8 px-3 rounded-full text-sm font-semibold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/20 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {onOpenActivity && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOpenActivity(item.activityId)}
            className="h-8 px-3 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
          >
            Otvoriť aktivitu
          </button>
        </div>
      )}

      {item.notes && (
        <div className="mt-3 text-sm opacity-90">{item.notes}</div>
      )}

      {/* Podrobné grafy */}
      <DetailSection title="Podrobné grafy" defaultOpen>
        <ActivityStreamCharts streams={streams} compact={compactChart} />
      </DetailSection>

      {/* Mapa trasy */}
      <DetailSection title="Mapa trasy" defaultOpen={false}>
        <ActivityRouteMap points={routePoints} />
      </DetailSection>

      {/* Splits */}
      {splits.length > 0 && (
        <DetailSection title="Splits" defaultOpen>
          <ul className="list-disc pl-5">
            {splits.map((sp: any, idx: number) => (
              <li key={sp.split_index ?? idx}>
                Split {sp.split_index ?? idx}: {formatDistance(sp.distance_m)},{" "}
                {fmtSecondsHMS(sp.moving_time_s)}
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {/* Laps */}
      {laps.length > 0 && (
        <DetailSection title="Laps" defaultOpen={false}>
          <ul className="list-disc pl-5">
            {laps.map((lap: any, idx: number) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {formatDistance(lap.distance_m)},{" "}
                {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}