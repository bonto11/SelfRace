"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { Segments } from "@/app/shared/ui/widget/WidgetParts";
import { apiSaveNutritionProfile } from "@/app/features/nutrition/api/nutrition";
import type { Calibration, NutritionProfile } from "@/app/features/nutrition/types/nutrition";
import { MACRO_COLOR, fmtInt, nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";

/**
 * Kalibrácia výdaja z váhy a celých dní (BE Services/nutrition_calibration.py).
 * Úprimne: kým nie je dosť dát, ukazuje len, čo ešte chýba.
 */
export default function CalibrationCard({
  userId,
  calibration,
  profile,
  locale,
  readOnly,
  onChanged,
}: {
  userId: number;
  calibration: Calibration | null | undefined;
  profile: NutritionProfile;
  locale: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  if (!calibration) return null;
  const c = calibration;
  const factor = c.factor ?? 1;

  const reset = async () => {
    const ok = await confirm({
      title: t("nutrition.calibration.resetTitle"),
      message: t("nutrition.calibration.resetMessage"),
      okText: t("nutrition.calibration.reset"),
      cancelText: t("common.cancel"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiSaveNutritionProfile(userId, {
        goal: profile.goal,
        goal_rate_pct: profile.goal_rate_pct,
        bmr_manual: profile.bmr_manual,
        neat_factor: profile.neat_factor,
        protein_g_per_kg: profile.protein_g_per_kg,
        mode: profile.mode,
        reset_calibration: true,
      });
      toast.success(t("nutrition.calibration.resetDone"));
      onChanged();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-3"].join(" ")} style={SURFACE_CARD_STYLE}>
      <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
        {t("nutrition.calibration.title")}
      </h3>
      {c.status === "ok" ? (
        <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
          {fmt(t("nutrition.calibration.ok"), {
            real: fmtInt(c.real_tdee_kcal, locale),
            model: fmtInt(c.model_tdee_kcal, locale),
            f: factor.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
            {t("nutrition.calibration.collecting")}
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
              {fmt(t("nutrition.calibration.days"), { n: c.complete_days, t: c.need_complete_days })}
            </span>
            <Segments done={Math.min(c.complete_days, c.need_complete_days)} total={c.need_complete_days} color={MACRO_COLOR.kcal} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
              {fmt(t("nutrition.calibration.weighins"), { n: c.weighins, t: c.need_weighins, s: c.need_span_days })}
            </span>
            <Segments done={Math.min(c.weighins, c.need_weighins)} total={c.need_weighins} color={MACRO_COLOR.protein_g} />
          </div>
          {factor !== 1 ? (
            <p className="text-xs" style={{ color: appColors.textMuted }}>
              {fmt(t("nutrition.calibration.keeping"), {
                f: factor.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              })}
            </p>
          ) : null}
        </div>
      )}
      {c.status === "ok" && c.clamped ? (
        <p className="text-xs leading-relaxed" style={{ color: appColors.statusWarning }}>
          {t("nutrition.calibration.clamped")}
        </p>
      ) : null}
      <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
        {t("nutrition.calibration.honest")}
      </p>
      {!readOnly && (factor !== 1 || c.status === "ok") ? (
        <div>
          <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
            {t("nutrition.calibration.reset")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
