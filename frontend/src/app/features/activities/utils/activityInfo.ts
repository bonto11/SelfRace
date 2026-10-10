/*
 * Text pod „i“ pre activity widgety AJ ich detail – rovnaký na oboch
 * miestach, aby user nemusel hľadať vysvetlenie inde. Widget je zámerne
 * strohý; čo znamená, ako sa počíta a prečo sú dobré práve také hodnoty,
 * je tu.
 */
import type { useT } from "@/app/shared/i18n/useT";

type T = ReturnType<typeof useT>;

export type ActivityInfoKey =
  | "load"
  | "mono"
  | "pareto"
  | "streak"
  | "monthly"
  | "strength"
  | "exerciseProgress"
  | "routes"
  | "today"
  | "wrapped";

export function activityInfo(t: T, key: ActivityInfoKey): string {
  switch (key) {
    case "load":
      return t("activityWidgets.info.load");
    case "mono":
      return t("activityWidgets.info.mono");
    case "pareto":
      return t("activityWidgets.info.pareto");
    case "streak":
      return t("activityWidgets.info.streak");
    case "monthly":
      return t("activityWidgets.info.monthly");
    case "strength":
      return t("activityWidgets.info.strength");
    case "exerciseProgress":
      return t("activityWidgets.info.exerciseProgress");
    case "routes":
      return t("activityWidgets.info.routes");
    case "today":
      return t("activityWidgets.info.today");
    case "wrapped":
      return t("activityWidgets.info.wrapped");
  }
}
