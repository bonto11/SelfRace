// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { minToHM, fmtRange } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

const TOOLTIP_WEEKLY_LOAD = [
  "Toto je súčet tréningového času za posledných 7 dní (rolling window).",
  "",
  "Prečo 7 dní?",
  "• Je to najjednoduchší spôsob, ako rýchlo vidieť „aktuálny load“ bez toho, aby ťa mýlil kalendárny pondelok/nedeľa.",
  "",
  "Ako čítať percentá vs. predošlých 7 dní:",
  "• +20% a viac: výrazný skok objemu → často rastie únava a riziko preťaženia (najmä ak sa to deje viac týždňov po sebe).",
  "• -20% a menej: výrazný pokles → môže byť deload/choroba/voľno; nie je to zlé, len to ovplyvní formu a „sharpness“.",
  "• okolo 0%: stabilita → dobré pre budovanie konzistentnej vytrvalosti.",
  "",
  "Tip:",
  "• Bezpečný progres je typicky skôr postupný (napr. 5–10% týždenne), nie skokovo. Skoky sa dejú, ale mali by byť zámerné a následne vyvážené ľahším týždňom.",
].join("\n");

export default function WeeklyLoadWidget({
  title = "Záťaž – posledných 7 dní",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  const r7 = rolling7?.("time");
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);

  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  const diffPct: number | null = useMemo(() => {
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  let note = "—";
  let accent: string = appColors.stateNeutral;

  if (!loading) {
    if (diffPct == null) {
      note = "—";
      accent = "none";
    } else if (diffPct > 20) {
      note = "↑ oproti predošlým 7 dňom výrazne viac";
      accent = appColors.stateWarning;
    } else if (diffPct < -20) {
      note = "↓ výrazne menej než predchádzajúcich 7 dní";
      accent = appColors.stateWarning;
    } else {
      note = "≈ podobne ako predchádzajúcich 7 dní";
      accent = "none";
    }
  }

  const rangeTxt =
    r7?.last?.range?.start && r7?.last?.range?.end
      ? fmtRange(r7.last.range.start, r7.last.range.end)
      : "—";

  return (
    <WidgetCard
      title={title} // ✅ string only
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
      actions={<TooltipIcon text={TOOLTIP_WEEKLY_LOAD} />} // ✅ tooltip in header
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP} aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{h}</span>
            <span className={WIDGET_VALUE_UNIT}>h</span>
            <span className={WIDGET_VALUE_PRIMARY}>
              {String(m).padStart(2, "0")}
            </span>
            <span className={WIDGET_VALUE_UNIT}>m</span>
          </div>

          <p className={WIDGET_NOTE}>
            {note}
            {rangeTxt && rangeTxt !== "—" ? ` • ${rangeTxt}` : ""}
          </p>
        </>
      )}
    </WidgetCard>
  );
}