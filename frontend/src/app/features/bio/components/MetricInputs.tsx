"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
// ✅ Import nášho točiaceho bubna
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetVo2MeasuredLatest,
  apiGetVo2EstimatedLatest,
  apiGetBodyFatLatest,
  apiGetWeightLatest,
  apiGetHrMaxLatest,
  apiSaveMetric,
} from "@/app/features/performance/api/userMetrics";

import type {
  LatestMetricsMap,
  EditableMetricKey,
  MetricState,
  DirtyMap,
} from "@/app/features/performance/types/performance";
import {
  buildMetricPlaceholders,
  formatBmiFromLatest,
} from "@/app/features/performance/utils/performance";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_STACK,
  SECTION_STYLE,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function ProfileMetricInputs() {
  const { userId } = useUserId() as { userId: number | null };
  const t = useT();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<LatestMetricsMap | null>(null);

  const [m, setM] = useState<MetricState>({
    weight_kg: null,
    body_fat_pct: null,
    HR_max: null,
    VO2Max_measured: null,
    VO2Max_estimated: null,
  });

  const [dirty, setDirty] = useState<DirtyMap>({
    weight_kg: false,
    body_fat_pct: false,
    HR_max: false,
    VO2Max_measured: false,
    VO2Max_estimated: false,
  });

  const loadAllLatest = useCallback(async (uid: number) => {
    try {
      setLoading(true);
      const [vMeas, vEst, bFat, weight, hrMax] = await Promise.all([
        apiGetVo2MeasuredLatest(uid),
        apiGetVo2EstimatedLatest(uid),
        apiGetBodyFatLatest(uid),
        apiGetWeightLatest(uid),
        apiGetHrMaxLatest(uid),
      ]);

      setLatest({
        VO2Max_measured: vMeas?.data,
        VO2Max_estimated: vEst?.data,
        body_fat_pct: bFat?.data,
        weight_kg: weight?.data,
        HR_max: hrMax?.data,
      });
    } catch (e) {
      console.warn("[ProfileMetricInputs] bulk load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) loadAllLatest(userId);
  }, [userId, loadAllLatest]);

  const ph = useMemo(() => buildMetricPlaceholders(t, latest), [latest, t]);
  const bmiText = useMemo(() => formatBmiFromLatest(latest), [latest]);

  function onChangeNumber<K extends EditableMetricKey>(key: K, val: number | "") {
    setDirty((d) => ({ ...d, [key]: true }));
    setM((s) => ({ ...s, [key]: val === "" ? null : val }));
  }

  async function handleSave() {
    if (!userId) {
      toast.error(t("api.common.missingUserAuth"));
      return;
    }

    const toSave = (Object.keys(dirty) as EditableMetricKey[]).filter(
      (k) => dirty[k] && m[k] !== null
    );

    if (!toSave.length) {
      toast.error(t("performance.metrics.errorNoValues"));
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        toSave.map((k) => apiSaveMetric(userId, k, Number(m[k])))
      );

      toast.success(t("performance.metrics.saveSuccess"));
      
      await loadAllLatest(userId);

      setM({
        weight_kg: null,
        body_fat_pct: null,
        HR_max: null,
        VO2Max_measured: null,
        VO2Max_estimated: null,
      });
      setDirty({
        weight_kg: false,
        body_fat_pct: false,
        HR_max: false,
        VO2Max_measured: false,
        VO2Max_estimated: false,
      });
      setOpen(false);
    } catch (e) {
      toast.error(t("api.performance.metricsSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <InputsCard
      title={t("performance.metrics.title")}
      subtitle={t("performance.metrics.subtitle")}
      open={open}
      onOpenChange={setOpen}
      actions={
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={loading || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {loading ? t("common.saving") : t("common.save")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          {/* Váha */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.weightLabel")}
            </div>
            {/* ✅ Nahradené za NumberWheelField */}
            <NumberWheelField
              min={30}
              max={200}
              step={0.5}
              hint={t("common.units.kg")}
              value={m.weight_kg ?? ""}
              disabled={loading}
              onChange={(val) => onChangeNumber("weight_kg", val)}
            />
          </section>

          {/* Body Fat */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.fatLabel")}
            </div>
            {/* ✅ Nahradené za NumberWheelField */}
            <NumberWheelField
              min={3}
              max={50}
              step={0.5}
              hint="%"
              value={m.body_fat_pct ?? ""}
              disabled={loading}
              onChange={(val) => onChangeNumber("body_fat_pct", val)}
            />
          </section>

          {/* HR Max */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.hrMaxLabel")}
            </div>
            {/* ✅ Nahradené za NumberWheelField */}
            <NumberWheelField
              min={100}
              max={250}
              step={1}
              hint="bpm"
              value={m.HR_max ?? ""}
              disabled={loading}
              onChange={(val) => onChangeNumber("HR_max", val)}
            />
          </section>

          {/* VO2 Max Duo */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("VO2Max.title")}
            </div>
            <div className={FORM_GRID_SPLIT}>
              {/* ✅ Nahradené za NumberWheelField pre AI Odhad */}
              <NumberWheelField
                min={20}
                max={90}
                step={1}
                hint="AI"
                value={m.VO2Max_estimated ?? ""}
                disabled={loading}
                onChange={(val) => onChangeNumber("VO2Max_estimated", val)}
              />
              {/* ✅ Nahradené za NumberWheelField pre Hodinky */}
              <NumberWheelField
                min={20}
                max={90}
                step={1}
                hint="Watch"
                value={m.VO2Max_measured ?? ""}
                disabled={loading}
                onChange={(val) => onChangeNumber("VO2Max_measured", val)}
              />
            </div>
          </section>

          {/* BMI (Zostáva obyčajný TextField lebo je len na čítanie) */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.bmiLabel")}
            </div>
            <TextField value={bmiText || "—"} disabled />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}