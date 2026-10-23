"use client";

import { Plus, X } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import NumberField from "@/app/shared/ui/components/NumberField";
import TextField from "@/app/shared/ui/components/TextField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT, type TKey } from "@/app/shared/i18n/useT";
import type { FoodItem } from "@/app/features/nutrition/types/nutrition";
import { MACRO_KEYS, fmtInt, scaleItem, sumMacros } from "@/app/features/nutrition/utils/nutrition";

type Num = number | "";

/**
 * Riadok formulára. `base` = položka, z ktorej sa prepočítava pri zmene
 * gramov – PREČO: prepočet z už zaokrúhlených čísel by pri písaní
 * „1 → 15 → 150“ ujížďal o percentá.
 */
export type DraftRow = {
  name: string;
  grams: Num;
  kcal: Num;
  protein_g: Num;
  carbs_g: Num;
  fat_g: Num;
  base: FoodItem;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function rowFromItem(item: FoodItem): DraftRow {
  return {
    name: item.name,
    grams: item.grams ?? "",
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    base: item,
  };
}

export function emptyRow(): DraftRow {
  return rowFromItem({ name: "", grams: null, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
}

export function itemFromRow(row: DraftRow): FoodItem {
  const p = num(row.protein_g) ?? 0;
  const c = num(row.carbs_g) ?? 0;
  const f = num(row.fat_g) ?? 0;
  const kcal = num(row.kcal);
  const grams = num(row.grams);
  return {
    name: row.name.trim(),
    grams: grams && grams > 0 ? grams : null,
    // bez kcal ich dopočítame z makier (rovnako ako BE)
    kcal: kcal ?? Math.round(4 * p + 4 * c + 9 * f),
    protein_g: p,
    carbs_g: c,
    fat_g: f,
  };
}

export function rowsValid(rows: DraftRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.name.trim().length > 0);
}

export default function DraftItemsEditor({
  rows,
  onChange,
  locale,
  allowAddRemove = true,
}: {
  rows: DraftRow[];
  onChange: (rows: DraftRow[]) => void;
  locale: string;
  allowAddRemove?: boolean;
}) {
  const t = useT();

  const update = (i: number, next: DraftRow) => onChange(rows.map((r, j) => (j === i ? next : r)));

  const changeGrams = (i: number, v: Num) => {
    const row = rows[i];
    const g = num(v);
    if (!g || g <= 0 || !row.base.grams) {
      update(i, { ...row, grams: v });
      return;
    }
    const s = scaleItem(row.base, g);
    update(i, { ...row, grams: v, kcal: s.kcal, protein_g: s.protein_g, carbs_g: s.carbs_g, fat_g: s.fat_g });
  };

  // ručná zmena čísla = nový základ pre ďalší prepočet gramov
  const changeValue = (i: number, key: "kcal" | "protein_g" | "carbs_g" | "fat_g", v: Num) => {
    const row = { ...rows[i], [key]: v };
    update(i, { ...row, base: itemFromRow(row) });
  };

  const totals = sumMacros(rows.map(itemFromRow));

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div
          key={i}
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
        >
          <div className="flex items-end gap-2">
            <TextField
              containerClassName="flex-1 min-w-0"
              label={t("nutrition.draft.name")}
              value={row.name}
              maxLength={120}
              onChange={(e) => update(i, { ...row, name: e.target.value })}
            />
            <NumberField
              containerClassName="w-24 shrink-0"
              label={t("nutrition.draft.grams")}
              unit="g"
              min={1}
              max={5000}
              step={1}
              value={row.grams}
              showReset={false}
              onChange={(v) => changeGrams(i, v)}
            />
            {allowAddRemove && rows.length > 1 ? (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="w-8 h-10 shrink-0 grid place-items-center rounded-lg opacity-60 hover:opacity-100"
                aria-label={t("nutrition.draft.removeItem")}
                style={{ color: appColors.textMuted }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <NumberField
              label={t("nutrition.draft.kcal")}
              min={0}
              max={10000}
              step={1}
              value={row.kcal}
              showReset={false}
              onChange={(v) => changeValue(i, "kcal", v)}
            />
            {MACRO_KEYS.map((k) => (
              <NumberField
                key={k}
                label={t(`nutrition.macrosShort.${k}` as TKey)}
                min={0}
                max={1000}
                step={0.1}
                value={row[k]}
                showReset={false}
                onChange={(v) => changeValue(i, k, v)}
              />
            ))}
          </div>
        </div>
      ))}

      {allowAddRemove ? (
        <div>
          <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => onChange([...rows, emptyRow()])}>
            {t("nutrition.draft.addItem")}
          </Button>
        </div>
      ) : null}

      {rows.length > 1 ? (
        <div className="text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
          {t("nutrition.draft.total")}: {fmtInt(totals.kcal, locale)} kcal · {t("nutrition.macrosShort.protein_g")}{" "}
          {fmtInt(totals.protein_g, locale)} g · {t("nutrition.macrosShort.carbs_g")} {fmtInt(totals.carbs_g, locale)} g ·{" "}
          {t("nutrition.macrosShort.fat_g")} {fmtInt(totals.fat_g, locale)} g
        </div>
      ) : null}
    </div>
  );
}
