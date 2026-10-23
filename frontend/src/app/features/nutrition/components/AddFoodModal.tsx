"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Camera, Clock, ScanText, Sparkles, Star, Trash2 } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import TextField from "@/app/shared/ui/components/TextField";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT, type TKey } from "@/app/shared/i18n/useT";
import {
  apiAddFoodFavorite,
  apiAddFoodLog,
  apiDeleteFoodFavorite,
  apiFoodFavorites,
  apiLookupBarcode,
  apiParseFoodPhoto,
  apiParseFoodText,
  apiRecentFoods,
} from "@/app/features/nutrition/api/nutrition";
import {
  MEALS,
  type FoodFavorite,
  type FoodItem,
  type FoodProduct,
  type FoodSource,
  type Meal,
  type RecentFood,
} from "@/app/features/nutrition/types/nutrition";
import { fmtInt, nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";
import NutritionModal from "@/app/features/nutrition/components/NutritionModal";
import DraftItemsEditor, {
  emptyRow,
  itemFromRow,
  rowFromItem,
  rowsValid,
  type DraftRow,
} from "@/app/features/nutrition/components/DraftItemsEditor";
import BarcodeScanner from "@/app/features/nutrition/components/BarcodeScanner";
import LabelFlow from "@/app/features/nutrition/components/LabelFlow";
import PhotoPick from "@/app/features/nutrition/components/PhotoPick";
import ProductPortion from "@/app/features/nutrition/components/ProductPortion";

type Tab = "text" | "photo" | "scan" | "label" | "favorites" | "recent" | "manual";
const TABS: Tab[] = ["text", "photo", "scan", "label", "favorites", "recent", "manual"];

/** produkt zo skenu / etikety čakajúci na zadanie porcie */
type Picked = { product: FoodProduct; source: "barcode" | "label" };

type Draft = {
  rows: DraftRow[];
  source: FoodSource;
  confidence: number | null;
  note: string | null;
  raw: string | null;
};

/** nízka istota AI = upozorniť, nech user skontroluje porcie */
const LOW_CONFIDENCE = 0.6;

/** predvolená časť dňa podľa hodiny */
export function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

function ItemButton({ title, sub, onClick, right }: { title: string; sub: string; onClick: () => void; right?: ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
    >
      <button type="button" onClick={onClick} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
          {title}
        </div>
        <div className="text-xs truncate tabular-nums" style={{ color: appColors.textMuted }}>
          {sub}
        </div>
      </button>
      {right}
    </div>
  );
}

export default function AddFoodModal({
  userId,
  date,
  initialMeal,
  locale,
  onClose,
  onSaved,
}: {
  userId: number;
  date: string;
  initialMeal?: Meal;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [meal, setMeal] = useState<Meal>(initialMeal ?? mealForNow());
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFav, setSaveFav] = useState(false);
  const [favName, setFavName] = useState("");

  const [favorites, setFavorites] = useState<FoodFavorite[] | null>(null);
  const [recent, setRecent] = useState<RecentFood[] | null>(null);

  // fáza 2–3: fotka taniera, sken, etiketa
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoHint, setPhotoHint] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [lookup, setLookup] = useState<{ busy: boolean; notFound: string | null; offError: boolean }>({
    busy: false,
    notFound: null,
    offError: false,
  });
  // nový kľúč = nový skener (po „nenájdené“ sa dá skenovať znova)
  const [scanKey, setScanKey] = useState(0);
  const [labelBarcode, setLabelBarcode] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "favorites" && favorites === null) {
      apiFoodFavorites(userId)
        .then((d) => setFavorites(d.items))
        .catch(() => setFavorites([]));
    }
    if (tab === "recent" && recent === null) {
      apiRecentFoods(userId)
        .then((d) => setRecent(d.items))
        .catch(() => setRecent([]));
    }
  }, [tab, userId, favorites, recent]);

  const openDraft = (items: FoodItem[], source: FoodSource, extra?: Partial<Draft>) => {
    setDraft({ rows: items.map(rowFromItem), source, confidence: null, note: null, raw: null, ...extra });
    setSaveFav(false);
    setFavName(extra?.raw ?? items.map((i) => i.name).join(", ").slice(0, 60));
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setDraft(null);
    setPicked(null);
    setLookup({ busy: false, notFound: null, offError: false });
    if (next !== "label") setLabelBarcode(null);
    if (next === "manual") openDraft([itemFromRow(emptyRow())], "manual");
  };

  const parsePhoto = async () => {
    if (!photo || parsing) return;
    setParsing(true);
    try {
      const d = await apiParseFoodPhoto(userId, photo, photoHint.trim() || undefined);
      openDraft(d.items, "photo", { confidence: d.confidence, note: d.note, raw: d.raw_input });
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setParsing(false);
    }
  };

  const onBarcode = async (code: string) => {
    setLookup({ busy: true, notFound: null, offError: false });
    try {
      const r = await apiLookupBarcode(userId, code);
      if (r.found && r.product) {
        setPicked({ product: r.product, source: "barcode" });
        setLookup({ busy: false, notFound: null, offError: false });
      } else {
        setLookup({ busy: false, notFound: r.barcode, offError: !!r.off_error });
      }
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
      setLookup({ busy: false, notFound: null, offError: false });
      setScanKey((k) => k + 1);
    }
  };

  const saveProductItem = async (item: FoodItem) => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await apiAddFoodLog(userId, {
        date,
        meal,
        source: picked.source,
        items: [item],
        product_id: picked.product.id,
      });
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
      setSaving(false);
      return;
    }
    toast.success(t("nutrition.add.saved"));
    setSaving(false);
    onSaved();
    onClose();
  };

  const parse = async () => {
    const value = text.trim();
    if (!value || parsing) return;
    setParsing(true);
    try {
      const d = await apiParseFoodText(userId, value);
      openDraft(d.items, "text", { confidence: d.confidence, note: d.note, raw: d.raw_input });
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (!draft || !rowsValid(draft.rows) || saving) return;
    setSaving(true);
    const items = draft.rows.map(itemFromRow);
    try {
      await apiAddFoodLog(userId, {
        date,
        meal,
        source: draft.source,
        items,
        ai_confidence: draft.confidence,
        raw_input: draft.raw,
      });
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
      setSaving(false);
      return;
    }
    // obľúbené sú vedľajšia vec – ich chyba zápis nezruší
    if (saveFav && favName.trim()) {
      try {
        await apiAddFoodFavorite(userId, { name: favName.trim(), meal, items });
      } catch (e) {
        toast.error(nutritionErrorText(t, e));
      }
    }
    toast.success(t("nutrition.add.saved"));
    setSaving(false);
    onSaved();
    onClose();
  };

  const removeFavorite = async (fav: FoodFavorite) => {
    const ok = await confirm({
      title: t("nutrition.favorites.deleteTitle"),
      message: fav.name,
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDeleteFoodFavorite(userId, fav.id);
      setFavorites((prev) => (prev ?? []).filter((f) => f.id !== fav.id));
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    }
  };

  const macroLine = (m: { kcal: number; grams?: number | null }) =>
    [m.grams ? `${fmtInt(m.grams, locale)} g` : null, `${fmtInt(m.kcal, locale)} kcal`].filter(Boolean).join(" · ");

  const footer = draft ? (
    <>
      {tab !== "manual" ? (
        <Button size="sm" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
          {t("common.back")}
        </Button>
      ) : null}
      <Button size="sm" onClick={save} disabled={saving || !rowsValid(draft.rows)}>
        {saving ? t("nutrition.add.saving") : t("nutrition.add.save")}
      </Button>
    </>
  ) : undefined;

  return (
    <NutritionModal title={t("nutrition.add.title")} onClose={onClose} footer={footer}>
      {/* časť dňa */}
      <div className="flex flex-wrap gap-2">
        {MEALS.map((m) => (
          <Button key={m} type="button" size="xs" variant="prefs" active={meal === m} onClick={() => setMeal(m)}>
            {t(`nutrition.meals.${m}` as TKey)}
          </Button>
        ))}
      </div>

      {/* spôsob zápisu */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((k) => (
          <Button key={k} type="button" size="xs" variant="prefs" active={tab === k} onClick={() => switchTab(k)}>
            {t(`nutrition.add.tabs.${k}` as TKey)}
          </Button>
        ))}
      </div>

      {picked ? (
        <ProductPortion
          product={picked.product}
          locale={locale}
          saving={saving}
          onSave={saveProductItem}
          onBack={() => {
            setPicked(null);
            setScanKey((k) => k + 1);
          }}
        />
      ) : draft ? (
        <div className="flex flex-col gap-3">
          {(draft.source === "text" || draft.source === "photo") &&
          (draft.note || (draft.confidence != null && draft.confidence < LOW_CONFIDENCE)) ? (
            <div
              className="text-xs rounded-xl px-3 py-2 leading-relaxed"
              style={{
                color: appColors.textPrimary,
                background: appColors.accentYellowDim,
                border: `1px solid ${appColors.statusWarning}`,
              }}
            >
              {draft.confidence != null && draft.confidence < LOW_CONFIDENCE ? (
                <div className="font-semibold">{t("nutrition.add.lowConfidence")}</div>
              ) : null}
              {draft.note ? <div>{draft.note}</div> : null}
            </div>
          ) : null}

          <DraftItemsEditor
            rows={draft.rows}
            onChange={(rows) => setDraft({ ...draft, rows })}
            locale={locale}
          />

          {draft.source !== "favorite" ? (
            <div className="flex flex-col gap-2">
              <Checkbox
                checked={saveFav}
                onChange={(e) => setSaveFav(e.target.checked)}
                label={t("nutrition.add.saveFavorite")}
              />
              {saveFav ? (
                <TextField
                  label={t("nutrition.favorites.nameLabel")}
                  value={favName}
                  maxLength={120}
                  onChange={(e) => setFavName(e.target.value)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : tab === "text" ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full px-4 py-3 rounded-2xl border outline-none resize-none text-sm"
            style={{
              background: appColors.editableBg,
              borderColor: appColors.editableBorder,
              color: appColors.editableText,
            }}
            rows={3}
            maxLength={500}
            value={text}
            placeholder={t("nutrition.add.textPlaceholder")}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
            {t("nutrition.add.textHint")}
          </div>
          <div>
            <Button size="sm" leftIcon={<Sparkles size={14} />} onClick={parse} disabled={parsing || !text.trim()}>
              {parsing ? t("nutrition.add.parsing") : t("nutrition.add.parse")}
            </Button>
          </div>
        </div>
      ) : tab === "photo" ? (
        <div className="flex flex-col gap-2">
          <PhotoPick label={t("nutrition.photo.mealPhoto")} value={photo} onChange={setPhoto} />
          <TextField
            label={t("nutrition.photo.hintLabel")}
            placeholder={t("nutrition.photo.hintPlaceholder")}
            value={photoHint}
            maxLength={200}
            onChange={(e) => setPhotoHint(e.target.value)}
          />
          <div className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
            {t("nutrition.photo.privacy")}
          </div>
          <div>
            <Button size="sm" leftIcon={<Camera size={14} />} onClick={parsePhoto} disabled={parsing || !photo}>
              {parsing ? t("nutrition.add.parsing") : t("nutrition.add.parse")}
            </Button>
          </div>
        </div>
      ) : tab === "scan" ? (
        <div className="flex flex-col gap-3">
          {lookup.notFound ? (
            <div
              className="flex flex-col gap-2 rounded-xl px-3 py-3"
              style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-sm" style={{ color: appColors.textPrimary }}>
                {lookup.offError ? t("nutrition.scan.offError") : t("nutrition.scan.notFound")}
              </div>
              <div className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
                {lookup.notFound}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  leftIcon={<ScanText size={14} />}
                  onClick={() => {
                    const code = lookup.notFound;
                    switchTab("label");
                    setLabelBarcode(code);
                  }}
                >
                  {t("nutrition.scan.toLabel")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLookup({ busy: false, notFound: null, offError: false });
                    setScanKey((k) => k + 1);
                  }}
                >
                  {t("nutrition.scan.again")}
                </Button>
              </div>
            </div>
          ) : (
            <BarcodeScanner key={scanKey} onCode={onBarcode} busy={lookup.busy} />
          )}
        </div>
      ) : tab === "label" ? (
        <LabelFlow
          key={labelBarcode ?? "none"}
          userId={userId}
          barcode={labelBarcode}
          onProduct={(product) => setPicked({ product, source: "label" })}
        />
      ) : tab === "favorites" ? (
        <div className="flex flex-col gap-2">
          {favorites === null ? (
            <div className="text-sm" style={{ color: appColors.textMuted }}>
              {t("nutrition.loading")}
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-sm" style={{ color: appColors.textMuted }}>
              {t("nutrition.favorites.empty")}
            </div>
          ) : (
            favorites.map((f) => (
              <ItemButton
                key={f.id}
                title={f.name}
                sub={macroLine(f)}
                onClick={() => openDraft(f.items, "favorite")}
                right={
                  <button
                    type="button"
                    onClick={() => removeFavorite(f)}
                    className="w-8 h-8 grid place-items-center rounded-lg opacity-60 hover:opacity-100"
                    aria-label={t("common.delete")}
                    style={{ color: appColors.textMuted }}
                  >
                    <Trash2 size={15} />
                  </button>
                }
              />
            ))
          )}
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: appColors.textMuted }}>
            <Star size={12} /> {t("nutrition.favorites.hint")}
          </div>
        </div>
      ) : tab === "recent" ? (
        <div className="flex flex-col gap-2">
          {recent === null ? (
            <div className="text-sm" style={{ color: appColors.textMuted }}>
              {t("nutrition.loading")}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-sm" style={{ color: appColors.textMuted }}>
              {t("nutrition.recent.empty")}
            </div>
          ) : (
            recent.map((r, i) => (
              <ItemButton
                key={`${r.name}-${i}`}
                title={r.name}
                sub={macroLine(r)}
                onClick={() => openDraft([r], "recent")}
                right={<Clock size={14} style={{ color: appColors.textMuted }} />}
              />
            ))
          )}
        </div>
      ) : null}
    </NutritionModal>
  );
}
