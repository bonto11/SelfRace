"use client";

import { useState } from "react";
import { ScanText } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import NumberField from "@/app/shared/ui/components/NumberField";
import TextField from "@/app/shared/ui/components/TextField";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { apiParseLabel, apiSaveProduct } from "@/app/features/nutrition/api/nutrition";
import type { FoodProduct, FoodProductValues } from "@/app/features/nutrition/types/nutrition";
import { nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";
import PhotoPick from "@/app/features/nutrition/components/PhotoPick";

type Num = number | "";
type NumKey = "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g" | "fiber_100g" | "sugar_100g" | "salt_100g" | "serving_g";
type Form = { name: string; brand: string } & Record<NumKey, Num>;

const MAIN: NumKey[] = ["kcal_100g", "protein_100g", "carbs_100g", "fat_100g"];
const EXTRA: NumKey[] = ["fiber_100g", "sugar_100g", "salt_100g"];

function toForm(p: Partial<FoodProductValues>): Form {
  const n = (v: number | null | undefined): Num => (typeof v === "number" ? v : "");
  return {
    name: p.name ?? "",
    brand: p.brand ?? "",
    kcal_100g: n(p.kcal_100g),
    protein_100g: n(p.protein_100g),
    carbs_100g: n(p.carbs_100g),
    fat_100g: n(p.fat_100g),
    fiber_100g: n(p.fiber_100g),
    sugar_100g: n(p.sugar_100g),
    salt_100g: n(p.salt_100g),
    serving_g: n(p.serving_g),
  };
}

const numOrNull = (v: Num): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Produkt z fotky etikety (AI len prepíše hodnoty na 100 g) alebo ručne.
 * User hodnoty skontroluje a potvrdí – až potom sa produkt uloží (vidí ho
 * len on, viď sql/nutrition_phase2.sql).
 */
export default function LabelFlow({
  userId,
  barcode,
  onProduct,
}: {
  userId: number;
  barcode: string | null;
  onProduct: (p: FoodProduct) => void;
}) {
  const t = useT();
  const [label, setLabel] = useState<Blob | null>(null);
  const [front, setFront] = useState<Blob | null>(null);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [source, setSource] = useState<"label_ai" | "user">("label_ai");
  const [saving, setSaving] = useState(false);

  const read = async () => {
    if (!label || parsing) return;
    setParsing(true);
    try {
      const d = await apiParseLabel(userId, label, front, barcode);
      setForm(toForm(d.product));
      setSource("label_ai");
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setParsing(false);
    }
  };

  const manual = () => {
    setForm(toForm({}));
    setSource("user");
  };

  const valid = !!form && form.name.trim().length > 0 && typeof form.kcal_100g === "number";

  const save = async () => {
    if (!form || !valid || saving) return;
    setSaving(true);
    try {
      const { product } = await apiSaveProduct(userId, {
        barcode,
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        kcal_100g: Number(form.kcal_100g),
        protein_100g: numOrNull(form.protein_100g),
        carbs_100g: numOrNull(form.carbs_100g),
        fat_100g: numOrNull(form.fat_100g),
        fiber_100g: numOrNull(form.fiber_100g),
        sugar_100g: numOrNull(form.sugar_100g),
        salt_100g: numOrNull(form.salt_100g),
        serving_g: numOrNull(form.serving_g),
        source,
      });
      onProduct(product);
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="flex flex-col gap-3">
        {barcode ? (
          <p className="text-xs" style={{ color: appColors.textMuted }}>
            {t("nutrition.label.forBarcode")} {barcode}
          </p>
        ) : null}
        <PhotoPick label={t("nutrition.label.labelPhoto")} value={label} onChange={setLabel} />
        <PhotoPick label={t("nutrition.label.frontPhoto")} value={front} onChange={setFront} />
        <div className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
          {t("nutrition.label.hint")}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" leftIcon={<ScanText size={14} />} onClick={read} disabled={!label || parsing}>
            {parsing ? t("nutrition.label.reading") : t("nutrition.label.read")}
          </Button>
          <Button size="sm" variant="ghost" onClick={manual} disabled={parsing}>
            {t("nutrition.label.manual")}
          </Button>
        </div>
      </div>
    );
  }

  const field = (k: NumKey, max: number, step: number) => (
    <NumberField
      key={k}
      label={t(`nutrition.label.fields.${k}` as any)}
      min={0}
      max={max}
      step={step}
      value={form[k]}
      showReset={false}
      onChange={(v) => setForm({ ...form, [k]: v })}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {source === "label_ai" ? (
        <p
          className="text-xs rounded-xl px-3 py-2"
          style={{ color: appColors.textPrimary, background: appColors.accentYellowDim, border: `1px solid ${appColors.statusWarning}` }}
        >
          {t("nutrition.label.check")}
        </p>
      ) : null}
      <TextField
        label={t("nutrition.label.fields.name")}
        value={form.name}
        maxLength={160}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextField
        label={t("nutrition.label.fields.brand")}
        value={form.brand}
        maxLength={120}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
      />
      <div className="text-xs font-semibold" style={{ color: appColors.textSecondary }}>
        {t("nutrition.label.per100Title")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MAIN.map((k) => field(k, k === "kcal_100g" ? 1000 : 100, k === "kcal_100g" ? 1 : 0.1))}
        {EXTRA.map((k) => field(k, 100, k === "salt_100g" ? 0.01 : 0.1))}
        {field("serving_g", 5000, 1)}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setForm(null)} disabled={saving}>
          {t("common.back")}
        </Button>
        <Button size="sm" onClick={save} disabled={!valid || saving}>
          {saving ? t("nutrition.add.saving") : t("nutrition.label.saveProduct")}
        </Button>
      </div>
    </div>
  );
}
