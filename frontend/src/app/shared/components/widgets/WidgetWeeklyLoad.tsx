// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { minToHM, fmtRange } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function WeeklyLoadWidget({
  title,
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();
  const t = useT();

  const r7 = rolling7?.("time");
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  // Výpočet percentuálneho rozdielu
  const diffPct: number | null = useMemo(() => {
    if (!totalPrev && totalLast > 0) return 100; // Ak predtým netrénoval vôbec a teraz áno
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  // Určenie textu, farby a accentu pre WidgetCard
  const { note, accent, diffColor } = useMemo(() => {
    if (loading || diffPct == null) {
      return { note: "—", accent: "none", diffColor: "opacity-70" };
    }
    
    // Nárast o viac ako 20 % (Riziko únavy)
    if (diffPct > 20) {
      return {
        note: t("weeklyLoad.status.muchMore"),
        accent: appColors.stateWarning,
        diffColor: "text-red-400", 
      };
    }
    
    // Pokles o viac ako 20 % (Deload / Oddych)
    if (diffPct < -20) {
      return {
        note: t("weeklyLoad.status.muchLess"),
        accent: "none",
        diffColor: "text-blue-400",
      };
    }

    // Stabilná záťaž (Ideál)
    return {
      note: t("weeklyLoad.status.similar"),
      accent: "none",
      diffColor: "opacity-70",
    };
  }, [loading, diffPct, t]);

  const diffStr = diffPct !== null 
    ? `${diffPct > 0 ? "+" : ""}${Math.round(diffPct)} %` 
    : null;

  return (
    <WidgetCard
      title={title ?? t("weeklyLoad.widget.title")}
      tooltip={t("weeklyLoad.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP} aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1">
            <div className={WIDGET_VALUE_ROW}>
              <span className={WIDGET_VALUE_PRIMARY}>{h}</span>
              <span className={WIDGET_VALUE_UNIT}>h</span>
              <span className={WIDGET_VALUE_PRIMARY}>
                {String(m).padStart(2, "0")}
              </span>
              <span className={WIDGET_VALUE_UNIT}>m</span>
            </div>

            {/* Ukazovateľ percentuálneho rozdielu */}
            {diffStr && (
              <div className={`mt-2 text-sm font-bold tracking-wide ${diffColor}`}>
                {diffStr}
              </div>
            )}

            <p className={`${WIDGET_NOTE} ${diffStr ? "mt-1" : "mt-2"}`}>
              {note}
            </p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
