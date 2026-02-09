// src/shared/components/widgets/WidgetBodyFat.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { fmtDate } from "@/app/shared/utils/time";

import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import type {
  StaticProfile,
  MetricHistoryRow,
} from "@/app/features/profile/types/profile";

import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_VALUE_UNIT,
  WIDGET_PLACEHOLDER,
  WIDGET_ROW_BETWEEN,
  WIDGET_BLOCK,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

type MetricsRowFE = { updated_at: string; body_fat_pct: number | null };

function colorForLevel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();

  if (l.includes("athlete")) return appColors.stateAthletes;
  if (l.includes("fitness")) return appColors.stateFitness;
  if (l.includes("average")) return appColors.stateAverage;
  if (l.includes("essential")) return appColors.stateEssential;
  if (l.includes("obese")) return appColors.stateObese;

  return appColors.textMuted;
}

function classifyBodyFat(sex: "M" | "F", pct?: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const bands = getBodyFatBands(sex);
  const hit = bands.find(
    (b) => (b.min == null || pct >= b.min) && (b.max == null || pct <= b.max),
  );
  if (!hit) return null;
  return { label: hit.label.trim(), color: colorForLevel(hit.label) };
}

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = React.useState(true);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [latest, setLatest] = React.useState<MetricsRowFE | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [staticProfile, history] = await Promise.all([
          apiGetStaticProfile(userId),
          apiGetMetricHistory(userId, "body_fat_pct"),
        ]);

        if (!alive) return;

        setStat(staticProfile ?? null);

        const rowsBE: MetricHistoryRow[] = Array.isArray(history)
          ? history
          : [];
        const lastBE = rowsBE.length ? rowsBE[rowsBE.length - 1] : undefined;

        const last: MetricsRowFE | null = lastBE
          ? {
              updated_at: lastBE.measured_at,
              body_fat_pct:
                typeof lastBE.value_num === "number" ? lastBE.value_num : null,
            }
          : null;

        setLatest(last);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const pct = latest?.body_fat_pct ?? null;
  const level = classifyBodyFat(stat?.sex === "F" ? "F" : "M", pct);
  const accent = level?.color ?? appColors.brandPrimary;

  return (
    <WidgetCard
      title="Body Fat %"
      tooltip={t("bodyFat.widget.tooltip")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accent}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className={WIDGET_ROW_BETWEEN}>
          <div className={WIDGET_BLOCK}>
            <div className={WIDGET_META_LABEL}>
              merané: {fmtDate(latest?.updated_at ?? null)}
            </div>

            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {pct != null ? pct.toFixed(1) : "—"}
                <span className={WIDGET_VALUE_UNIT}>%</span>
              </div>

              {level ? (
                <Pill label={level.label} color={level.color} />
              ) : (
                <span className={WIDGET_PLACEHOLDER}>—</span>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}