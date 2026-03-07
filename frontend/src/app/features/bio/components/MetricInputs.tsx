"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { toast } from "@/app/shared/ui/components/Toast";

// Importujeme len čisté API funkcie
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

  // Načítanie dát cez sémantické API funkcie
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

  function onChangeNumber<K extends EditableMetricKey>(key: K, raw: string) {
    setDirty((d) => ({ ...d, [key]: true }));
    setM((s) => ({ ...s, [key]: raw === "" ? null : Number(raw) }));
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
      // Ukladáme každú zmenenú metriku cez apiSaveMetric
      await Promise.all(
        toSave.map((k) => apiSaveMetric(userId, k, Number(m[k])))
      );

      toast.success(t("performance.metrics.saveSuccess"));
      
      await loadAllLatest(userId);

      // Reset
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
            <TextField
              type="number"
              inputMode="decimal"
              value={m.weight_kg ?? ""}
              placeholder={ph.weight_kg || t("common.units.kg")}
              onChange={(e) => onChangeNumber("weight_kg", e.target.value)}
              disabled={loading}
            />
          </section>

          {/* Body Fat */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.fatLabel")}
            </div>
            <TextField
              type="number"
              inputMode="decimal"
              value={m.body_fat_pct ?? ""}
              placeholder={ph.body_fat_pct || "%"}
              onChange={(e) => onChangeNumber("body_fat_pct", e.target.value)}
              disabled={loading}
            />
          </section>

          {/* HR Max */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("performance.metrics.hrMaxLabel")}
            </div>
            <TextField
              type="number"
              inputMode="numeric"
              value={m.HR_max ?? ""}
              placeholder={ph.HR_max || "bpm"}
              onChange={(e) => onChangeNumber("HR_max", e.target.value)}
              disabled={loading}
            />
          </section>

          {/* VO2 Max Duo */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("VO2Max.title")}
            </div>
            <div className={FORM_GRID_SPLIT}>
              <TextField
                type="number"
                inputMode="decimal"
                value={m.VO2Max_estimated ?? ""}
                placeholder={ph.VO2Max_estimated || "AI"}
                onChange={(e) => onChangeNumber("VO2Max_estimated", e.target.value)}
                disabled={loading}
              />
              <TextField
                type="number"
                inputMode="decimal"
                value={m.VO2Max_measured ?? ""}
                placeholder={ph.VO2Max_measured || "Watch"}
                onChange={(e) => onChangeNumber("VO2Max_measured", e.target.value)}
                disabled={loading}
              />
            </div>
          </section>

          {/* BMI */}
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
