"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import DateField from "@/app/shared/ui/components/DateField";
import NumberField from "@/app/shared/ui/components/NumberField";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { appLocale } from "@/app/shared/i18n/locale";
import { apiSaveStaticProfile } from "@/app/features/performance/api/static";
import { apiSaveMetric } from "@/app/features/performance/api/userMetrics";
import {
  apiDeleteNutritionData,
  apiGetNutritionProfile,
  apiSaveNutritionProfile,
} from "@/app/features/nutrition/api/nutrition";
import type { NutritionGoal, NutritionProfileData } from "@/app/features/nutrition/types/nutrition";
import { nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";

type Num = number | "";

const GOALS: NutritionGoal[] = ["lose", "maintain", "gain"];
// zrkadlo BE Configs/nutrition.py – žiadne extrémne ciele v UI
const RATES: Record<"lose" | "gain", number[]> = { lose: [10, 15, 20], gain: [5, 7, 10] };
const DEFAULT_RATE: Record<"lose" | "gain", number> = { lose: 15, gain: 7 };
const NEAT_OPTIONS = [1.2, 1.3, 1.4, 1.5];
const PROTEIN_OPTIONS = [1.6, 1.8, 2.0, 2.2];
const MIN_AGE = 18;
const MIN_BMI_FOR_LOSS = 18.5;

function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(`${birth.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-3"].join(" ")} style={SURFACE_CARD_STYLE}>
      <div>
        <h2 className="text-base font-bold" style={{ color: appColors.textPrimary }}>
          {title}
        </h2>
        {hint ? (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: appColors.textMuted }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Úvodné nastavenie výživy aj neskoršia úprava. Pohlavie, narodenie a výška
 * sa ukladajú do profile_static, váha do meraní (users_metrics) – rovnaké
 * údaje ako na Bio/Výkone, nič sa neduplikuje. Prvé uloženie vyžaduje súhlas.
 */
export default function NutritionProfileSetup({
  userId,
  mode,
  onDone,
  onCancel,
}: {
  userId: number;
  mode: "setup" | "edit";
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const [data, setData] = useState<NutritionProfileData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const [sex, setSex] = useState<"M" | "F" | null>(null);
  const [birth, setBirth] = useState<string | null>(null);
  const [height, setHeight] = useState<Num>("");
  const [weight, setWeight] = useState<Num>("");
  const [goal, setGoal] = useState<NutritionGoal>("maintain");
  const [rate, setRate] = useState<number | null>(null);
  const [neat, setNeat] = useState(1.3);
  // null = automaticky podľa cieľa (BE PROTEIN_G_PER_KG_AUTO)
  const [protein, setProtein] = useState<number | null>(null);
  const [bmr, setBmr] = useState<Num>("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGetNutritionProfile(userId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setSex(d.body.sex);
        setBirth(d.body.birth_date ? d.body.birth_date.slice(0, 10) : null);
        setHeight(d.body.height_cm ?? "");
        setWeight(d.body.weight_kg ?? "");
        if (d.profile) {
          setGoal(d.profile.goal);
          setRate(d.profile.goal_rate_pct);
          setNeat(d.profile.neat_factor);
          setProtein(d.profile.protein_g_per_kg);
          setBmr(d.profile.bmr_manual ?? "");
        }
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [userId]);

  const age = ageFrom(birth);
  const minor = age != null && age < MIN_AGE;
  const bmi = typeof weight === "number" && typeof height === "number" && height > 0 ? weight / (height / 100) ** 2 : null;
  const lowBmi = bmi != null && bmi < MIN_BMI_FOR_LOSS;

  // neplatný cieľ (maloletý, nízke BMI) sa prepne na udržiavanie
  const effectiveGoal: NutritionGoal = minor || (goal === "lose" && lowBmi) ? "maintain" : goal;
  const effectiveRate = effectiveGoal === "maintain" ? null : rate ?? DEFAULT_RATE[effectiveGoal];

  const hasConsent = !!data?.profile?.consent_at;
  const bodyValid = !!birth && typeof height === "number" && height > 0 && typeof weight === "number" && weight > 0;
  const measuredBmr = data?.body.bmr_measured ?? null;
  const sexNeeded = bmr === "" && !measuredBmr && !sex;
  const canSave = !!data && bodyValid && !sexNeeded && (hasConsent || consent) && !saving;

  const bodyChanged = useMemo(() => {
    if (!data) return false;
    return (
      sex !== data.body.sex ||
      (birth ?? null) !== (data.body.birth_date ? data.body.birth_date.slice(0, 10) : null) ||
      (typeof height === "number" ? height : null) !== (data.body.height_cm ?? null)
    );
  }, [data, sex, birth, height]);

  const save = async () => {
    if (!canSave || !data) return;
    setSaving(true);
    try {
      if (bodyChanged) {
        await apiSaveStaticProfile(userId, {
          sex,
          birth_date: birth,
          height_cm: typeof height === "number" ? height : null,
        });
      }
      if (typeof weight === "number" && weight !== data.body.weight_kg) {
        await apiSaveMetric(userId, "weight_kg", weight);
      }
      await apiSaveNutritionProfile(userId, {
        goal: effectiveGoal,
        goal_rate_pct: effectiveRate,
        bmr_manual: typeof bmr === "number" ? bmr : null,
        neat_factor: neat,
        protein_g_per_kg: protein,
        consent: hasConsent ? undefined : consent,
      });
      toast.success(t("nutrition.setup.saved"));
      onDone();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setSaving(false);
    }
  };

  const removeAll = async () => {
    const ok = await confirm({
      title: t("nutrition.setup.deleteTitle"),
      message: t("nutrition.setup.deleteMessage"),
      okText: t("nutrition.setup.deleteOk"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDeleteNutritionData(userId);
      toast.success(t("nutrition.setup.deleted"));
      onDone();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    }
  };

  if (loadError) {
    return (
      <p className="text-sm mt-4" style={{ color: appColors.statusError }}>
        {t("nutrition.errors.request_failed")}
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-sm mt-4" style={{ color: appColors.textMuted }}>
        {t("nutrition.loading")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 mt-4 pb-12">
      {mode === "setup" ? (
        <Section title={t("nutrition.setup.introTitle")} hint={t("nutrition.setup.introText")}>
          <></>
        </Section>
      ) : null}

      <Section title={t("nutrition.setup.bodyTitle")} hint={t("nutrition.setup.bodyHint")}>
        <div className="flex flex-col gap-1">
          <div className="text-xs" style={{ color: appColors.textMuted }}>
            {t("nutrition.setup.sex")}
          </div>
          <div className="flex gap-2">
            {(["M", "F"] as const).map((s) => (
              <Button key={s} type="button" size="xs" variant="prefs" active={sex === s} onClick={() => setSex(s)} className="flex-1">
                {t(`nutrition.setup.sex${s}` as TKey)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xs" style={{ color: appColors.textMuted }}>
            {t("nutrition.setup.birthDate")}
          </div>
          <DateField value={birth} onChange={setBirth} max={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("nutrition.setup.height")} unit="cm" min={100} max={250} step={1} value={height} onChange={setHeight} />
          <NumberField label={t("nutrition.setup.weight")} unit="kg" min={30} max={300} step={0.1} value={weight} onChange={setWeight} />
        </div>
      </Section>

      <Section title={t("nutrition.setup.goalTitle")} hint={t("nutrition.setup.goalHint")}>
        <div className="flex gap-2">
          {GOALS.map((g) => {
            const disabled = g !== "maintain" && (minor || (g === "lose" && lowBmi));
            return (
              <Button
                key={g}
                type="button"
                size="xs"
                variant="prefs"
                active={effectiveGoal === g}
                disabled={disabled}
                onClick={() => {
                  setGoal(g);
                  setRate(g === "maintain" ? null : DEFAULT_RATE[g]);
                }}
                className="flex-1"
              >
                {t(`nutrition.goals.${g}` as TKey)}
              </Button>
            );
          })}
        </div>
        {minor ? (
          <p className="text-xs" style={{ color: appColors.statusWarning }}>
            {t("nutrition.setup.minorNote")}
          </p>
        ) : lowBmi && goal === "lose" ? (
          <p className="text-xs" style={{ color: appColors.statusWarning }}>
            {t("nutrition.setup.lowBmiNote")}
          </p>
        ) : null}
        {effectiveGoal !== "maintain" ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs" style={{ color: appColors.textMuted }}>
              {t(`nutrition.setup.rate.${effectiveGoal}` as TKey)}
            </div>
            <div className="flex gap-2">
              {RATES[effectiveGoal].map((r, i) => (
                <Button
                  key={r}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={effectiveRate === r}
                  onClick={() => setRate(r)}
                  className="flex-1"
                >
                  {fmt(t(`nutrition.setup.rateLevel${i}` as TKey), { n: r })}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title={t("nutrition.setup.advancedTitle")}>
        <div>
          <Button
            size="sm"
            variant="ghost"
            rightIcon={advanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? t("nutrition.setup.advancedHide") : t("nutrition.setup.advancedShow")}
          </Button>
        </div>
        {advanced ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-xs" style={{ color: appColors.textMuted }}>
                {t("nutrition.setup.neat")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NEAT_OPTIONS.map((n) => (
                  <Button key={n} type="button" size="xs" variant="prefs" active={neat === n} onClick={() => setNeat(n)}>
                    {t(`nutrition.setup.neatLevels.n${Math.round(n * 10)}` as TKey)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs" style={{ color: appColors.textMuted }}>
                {t("nutrition.setup.protein")}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="xs" variant="prefs" active={protein === null} onClick={() => setProtein(null)}>
                  {t("nutrition.setup.proteinAuto")}
                </Button>
                {PROTEIN_OPTIONS.map((p) => (
                  <Button key={p} type="button" size="xs" variant="prefs" active={protein === p} onClick={() => setProtein(p)} className="flex-1">
                    {`${p.toFixed(1)} g/kg`}
                  </Button>
                ))}
              </div>
              {protein === null ? (
                <div className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
                  {t("nutrition.setup.proteinAutoHint")}
                </div>
              ) : null}
            </div>
            <NumberField
              label={t("nutrition.setup.bmrManual")}
              hint={
                measuredBmr
                  ? fmt(t("nutrition.setup.bmrMeasured"), {
                      n: measuredBmr.kcal,
                      d: new Date(`${measuredBmr.date}T00:00:00`).toLocaleDateString(appLocale()),
                    })
                  : t("nutrition.setup.bmrManualHint")
              }
              unit="kcal"
              min={800}
              max={4000}
              step={1}
              value={bmr}
              onChange={setBmr}
            />
          </div>
        ) : null}
      </Section>

      {!hasConsent ? (
        <Section title={t("nutrition.setup.consentTitle")}>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("nutrition.setup.consent")} />
        </Section>
      ) : null}

      {sexNeeded ? (
        <p className="text-xs" style={{ color: appColors.statusWarning }}>
          {t("nutrition.setup.sexNeeded")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 justify-end">
        {mode === "edit" && hasConsent ? (
          <Button size="sm" variant="danger" onClick={removeAll} className="mr-auto">
            {t("nutrition.setup.delete")}
          </Button>
        ) : null}
        {onCancel ? (
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button size="sm" onClick={save} disabled={!canSave}>
          {saving ? t("nutrition.setup.saving") : t("nutrition.setup.save")}
        </Button>
      </div>
    </div>
  );
}
