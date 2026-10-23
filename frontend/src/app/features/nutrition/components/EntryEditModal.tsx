"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT, type TKey } from "@/app/shared/i18n/useT";
import { apiDeleteFoodLog, apiUpdateFoodLog } from "@/app/features/nutrition/api/nutrition";
import { MEALS, type FoodEntry, type Meal } from "@/app/features/nutrition/types/nutrition";
import { nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";
import NutritionModal from "@/app/features/nutrition/components/NutritionModal";
import DraftItemsEditor, {
  itemFromRow,
  rowFromItem,
  rowsValid,
  type DraftRow,
} from "@/app/features/nutrition/components/DraftItemsEditor";

export default function EntryEditModal({
  userId,
  entry,
  locale,
  onClose,
  onSaved,
}: {
  userId: number;
  entry: FoodEntry;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [rows, setRows] = useState<DraftRow[]>([rowFromItem(entry)]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!rowsValid(rows) || busy) return;
    setBusy(true);
    try {
      await apiUpdateFoodLog(userId, entry.id, { ...itemFromRow(rows[0]), meal });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t("nutrition.entry.deleteTitle"),
      message: entry.name,
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteFoodLog(userId, entry.id);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
      setBusy(false);
    }
  };

  return (
    <NutritionModal
      title={t("nutrition.entry.editTitle")}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="danger" onClick={remove} disabled={busy} className="mr-auto">
            {t("common.delete")}
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !rowsValid(rows)}>
            {t("nutrition.entry.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {MEALS.map((m) => (
          <Button key={m} type="button" size="xs" variant="prefs" active={meal === m} onClick={() => setMeal(m)}>
            {t(`nutrition.meals.${m}` as TKey)}
          </Button>
        ))}
      </div>
      <DraftItemsEditor rows={rows} onChange={setRows} locale={locale} allowAddRemove={false} />
    </NutritionModal>
  );
}
