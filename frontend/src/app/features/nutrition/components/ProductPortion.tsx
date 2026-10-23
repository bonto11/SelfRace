"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import NumberField from "@/app/shared/ui/components/NumberField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import type { FoodItem, FoodProduct } from "@/app/features/nutrition/types/nutrition";
import { MACRO_KEYS, fmtInt } from "@/app/features/nutrition/utils/nutrition";

type Num = number | "";

const PER100: Record<"protein_g" | "carbs_g" | "fat_g", "protein_100g" | "carbs_100g" | "fat_100g"> = {
  protein_g: "protein_100g",
  carbs_g: "carbs_100g",
  fat_g: "fat_100g",
};

/** položka jedla z produktu – hodnoty na 100 g × gramy */
export function itemFromProduct(product: FoodProduct, grams: number): FoodItem {
  const f = grams / 100;
  const r1 = (v: number | null) => Math.round((v ?? 0) * f * 10) / 10;
  return {
    name: product.name,
    grams,
    kcal: Math.round(product.kcal_100g * f),
    protein_g: r1(product.protein_100g),
    carbs_g: r1(product.carbs_100g),
    fat_g: r1(product.fat_100g),
  };
}

/**
 * Koľko z produktu user zjedol: gramy alebo počet porcií (keď obal porciu
 * uvádza). Hodnoty sa prepočítajú z 100 g – user nič nepíše ručne.
 */
export default function ProductPortion({
  product,
  locale,
  saving,
  onSave,
  onBack,
}: {
  product: FoodProduct;
  locale: string;
  saving: boolean;
  onSave: (item: FoodItem) => void;
  onBack: () => void;
}) {
  const t = useT();
  const [grams, setGrams] = useState<Num>(product.serving_g ?? 100);
  const g = typeof grams === "number" && grams > 0 ? grams : 0;
  const item = itemFromProduct(product, g);
  const serving = product.serving_g;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl p-3 flex flex-col gap-1"
        style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
          {product.name}
        </div>
        <div className="text-xs" style={{ color: appColors.textMuted }}>
          {[product.brand, product.barcode].filter(Boolean).join(" · ")}
        </div>
        <div className="text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
          {fmt(t("nutrition.product.per100"), { kcal: fmtInt(product.kcal_100g, locale) })} ·{" "}
          {MACRO_KEYS.map((k) => `${t(`nutrition.macrosShort.${k}` as TKey)} ${fmtInt(product[PER100[k]] ?? 0, locale)}`).join(" · ")}
        </div>
        {product.source === "off" ? (
          <div className="text-[11px]" style={{ color: appColors.textMuted }}>
            {t("nutrition.product.sourceOff")}
          </div>
        ) : null}
      </div>

      <div className="flex items-end gap-2">
        <NumberField
          containerClassName="w-32"
          label={t("nutrition.product.amount")}
          unit="g"
          min={1}
          max={5000}
          step={1}
          value={grams}
          showReset={false}
          onChange={setGrams}
        />
        <div className="flex flex-wrap gap-2 pb-1">
          {serving ? (
            [1, 2].map((n) => (
              <Button key={n} type="button" size="xs" variant="prefs" active={g === serving * n} onClick={() => setGrams(serving * n)}>
                {fmt(t(n === 1 ? "nutrition.product.serving1" : "nutrition.product.servingN"), {
                  n,
                  g: fmtInt(serving * n, locale),
                })}
              </Button>
            ))
          ) : null}
          <Button type="button" size="xs" variant="prefs" active={g === 100} onClick={() => setGrams(100)}>
            100 g
          </Button>
        </div>
      </div>

      <div className="text-sm tabular-nums" style={{ color: appColors.textPrimary }}>
        {fmtInt(item.kcal, locale)} kcal ·{" "}
        {MACRO_KEYS.map((k) => `${t(`nutrition.macrosShort.${k}` as TKey)} ${fmtInt(item[k], locale)} g`).join(" · ")}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onBack} disabled={saving}>
          {t("common.back")}
        </Button>
        <Button size="sm" onClick={() => onSave(item)} disabled={saving || g <= 0}>
          {saving ? t("nutrition.add.saving") : t("nutrition.add.save")}
        </Button>
      </div>
    </div>
  );
}
