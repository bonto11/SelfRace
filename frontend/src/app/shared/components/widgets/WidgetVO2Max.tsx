// src/shared/components/widgets/WidgetVO2Max.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { useUserId } from "@/app/shared/hooks/useUserId";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { fmtDate } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_PLACEHOLDER,
} from "@/app/shared/ui/tokens";

import type {
  HistoryRow,
  EstRow,
  Group,
  Range,
} from "@/app/features/profile/types/profile";
import { levelColor } from "@/app/features/profile/utils/profile";
import {
  apiGetVo2History,
  apiGetVo2Estimate,
} from "@/app/features/profile/api/metrics";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

function safeAgeYears(birthDate?: string) {
  if (!birthDate) return 0;
  const t = new Date(birthDate).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000)),
  );
}

export default function WidgetVO2Max({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();

  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = React.useState<string>("");
  const [est, setEst] = React.useState<EstRow | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [histRes, estRes] = await Promise.all([
          apiGetVo2History(userId),
          apiGetVo2Estimate(userId),
        ]);

        if (!alive) return;

        if (histRes) {
          setHistory(histRes.history ?? []);
          setSex(histRes.sex === "F" ? "F" : "M");
          setBirthDate(histRes.birth_date || "");
        } else {
          setHistory([]);
          setSex("M");
          setBirthDate("");
        }

        setEst(estRes ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const measured = history.length ? history[history.length - 1] : null;
  const mVO2 = measured?.VO2Max ?? null;

  // pásma podľa veku/pohlavia
  let ranges: Range[] = [];
  try {
    const age = safeAgeYears(birthDate);
    const g = (vo2Ref as Group[]).find(
      (x) => x.sex === sex && age >= x.age_min && age <= x.age_max,
    );
    ranges = g?.ranges ?? [];
  } catch {
    ranges = [];
  }

  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find(
      (rr) =>
        (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max),
    );
    if (!hit) return null;
    const label = hit.label.trim();
    return { label, color: levelColor(label) };
  };

  const estVal = Number.isFinite(est?.value as number)
    ? Number(est?.value)
    : null;

  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(estVal);

  const accent =
    levelMeasured?.color ?? levelEstimated?.color ?? appColors.brandPrimary;

  return (
    <WidgetCard
      title="VO₂Max"
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] items-start gap-6 md:gap-10">
          {/* estimated */}
          <div className="min-w-0">
            <div className={WIDGET_META_LABEL}>
              odhad: {fmtDate(est?.updated_at ?? null)}
            </div>

            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {estVal != null ? estVal.toFixed(1) : "—"}
              </div>
              {levelEstimated ? (
                <Pill
                  label={levelEstimated.label}
                  color={levelEstimated.color}
                />
              ) : (
                <span className={WIDGET_PLACEHOLDER}>—</span>
              )}
            </div>
          </div>

          <div
            className="hidden md:block w-px mx-auto"
            style={{ background: appColors.surfaceCardBorder, opacity: 0.6 }}
            aria-hidden="true"
          />

          {/* measured */}
          <div className="min-w-0">
            <div className={WIDGET_META_LABEL}>
              merané: {fmtDate(measured?.updated_at ?? null)}
            </div>

            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {mVO2 != null ? mVO2.toFixed(1) : "—"}
              </div>
              {levelMeasured ? (
                <Pill label={levelMeasured.label} color={levelMeasured.color} />
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
