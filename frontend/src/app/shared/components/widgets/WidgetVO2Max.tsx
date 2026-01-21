// src/shared/components/widgets/WidgetVO2Max.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import Pill from "@/app/shared/components/ui/Pill";
import { useUserId } from "@/app/shared/hooks/useUserId";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/app/shared/theme/tokens";
import { NO_X_OVERFLOW, WIDGET_LOADING_WRAP } from "@/app/shared/theme/uiTokens";
import { fmtDate } from "@/app/shared/utils/time";
import {
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
import { appColors } from "@/app/shared/theme/app_colors";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

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

  // nájdi pásma podľa veku/pohlavia
  let ranges: Range[] = [];
  try {
    const age = birthDate
      ? Math.floor(
          (Date.now() - new Date(birthDate).getTime()) /
            (365.25 * 24 * 3600 * 1000)
        )
      : 0;

    const g = (vo2Ref as Group[]).find(
      (x) => x.sex === sex && age >= x.age_min && age <= x.age_max
    );
    ranges = g?.ranges ?? [];
  } catch {
    ranges = [];
  }

  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find(
      (rr) => (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max)
    );
    if (!hit) return null;
    const label = hit.label.trim();
    return { label, color: levelColor(label) };
  };

  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(
    Number.isFinite(est?.value as number) ? Number(est?.value) : null
  );

  const accentHex =
    levelMeasured?.color ??
    levelEstimated?.color ??
    (THEME as any)?.accent?.primary ??
    (THEME as any)?.chart?.neutral ??
    appColors.textMuted;

  return (
    <WidgetCard
      title="VO₂Max"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accentHex}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] items-start gap-6 md:gap-10">
          {/* ODHAD (ľavý blok) */}
          <div className="min-w-0">
            <div className="text-[11px] uppercase opacity-70">
              odhad: {fmtDate(est?.updated_at ?? null)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {Number.isFinite(est?.value as number)
                  ? Number(est?.value).toFixed(1)
                  : "—"}
              </div>
              {levelEstimated ? (
                <Pill label={levelEstimated.label} color={levelEstimated.color} />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>

          {/* separátor – md+ (bez statických farieb) */}
          <div
            className="hidden md:block w-px mx-auto"
            style={{ background: appColors.surfaceCardBorder, opacity: 0.6 }}
            aria-hidden="true"
          />

          {/* MERANÉ (pravý blok) */}
          <div className="min-w-0">
            <div className="text-[11px] uppercase opacity-70">
              merané: {fmtDate(measured?.updated_at)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {mVO2 != null ? mVO2.toFixed(1) : "—"}
              </div>
              {levelMeasured ? (
                <Pill label={levelMeasured.label} color={levelMeasured.color} />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}