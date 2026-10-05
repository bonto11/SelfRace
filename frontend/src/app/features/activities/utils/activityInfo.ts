/*
 * Text pod „i“ pre activity widgety AJ ich detail – rovnaký na oboch
 * miestach, aby user nemusel hľadať vysvetlenie inde. Skladá sa z pôvodného
 * vysvetlenia metriky a krátkeho „ako čítať widget“ (to sa z widgetu
 * presunulo sem, aby widget nebol presýtený textom).
 */
import type { useT } from "@/app/shared/i18n/useT";

type T = ReturnType<typeof useT>;

export type ActivityInfoKey = "load" | "mono" | "pareto" | "streak" | "monthly" | "strength" | "routes" | "today" | "wrapped";

export function activityInfo(t: T, key: ActivityInfoKey): string {
  switch (key) {
    case "load":
      return `${t("weeklyLoad.widget.tooltip")}\n\n${t("activityWidgets.read.load")}`;
    case "mono":
      return `${t("monoStrain.widget.tooltip")}\n\n${t("activityWidgets.read.mono")}`;
    case "pareto":
      return `${t("pareto8020.widget.tooltip")}\n\n${t("activityWidgets.read.pareto")}`;
    case "streak":
      return `${t("streak.widget.tooltip")}\n\n${t("activityWidgets.read.streak")}`;
    case "monthly":
      return `${t("monthlySummary.widget.tooltip")}\n\n${t("activityWidgets.read.monthly")}`;
    case "strength":
      return `${t("strengthLog.widget.tooltip")}\n\n${t("activityWidgets.read.strength")}`;
    case "routes":
      return t("activityWidgets.read.routes");
    case "today":
      return `${t("todayActivities.tooltip")}\n\n${t("activityWidgets.read.today")}`;
    case "wrapped":
      return t("activitiesWrapped.widget.tooltip");
  }
}
