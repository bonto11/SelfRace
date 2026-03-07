"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetVo2MeasuredLatest,
  apiGetVo2EstimatedLatest,
  apiGetBodyFatLatest,
  apiSaveMetric,
} from "@/app/features/performance/api/userMetrics";

// Ak ešte nemáš v userMetrics.ts tieto dve, budeme ich potrebovať pre váhu a tep
import { callBackend } from "@/app/shared/utils/callBackend";

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
  
  // Tento stav si nechávame kvôli placeholderom a BMI výpočtu
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

  // Pomocná funkcia na načítanie všetkých "Latest" dát po novom
  const loadAllLatest = async (uid: number) => {
    try {
      // Tu využijeme naše nové sémantické API
      const [vMeas, vEst, bFat, weight, hrMax] = await Promise.all([
        apiGetVo2MeasuredLatest(uid),
        apiGetVo2EstimatedLatest(uid),
        apiGetBodyFatLatest(uid),
        // Pre váhu a tep využijeme generický endpoint ak nemáme špecifický
        callBackend<any>(`/user-metrics/latest/${uid}?metric=weight_kg`, { method: "GET" }),
        callBackend<any>(`/user-metrics/latest/${uid}?metric=HR_max`, { method: "GET" }),
      ]);

      // Transformujeme na mapu, ktorú pôvodné UI očakáva
      const map: LatestMetricsMap = {
        VO2Max_measured: vMeas?.data,
        VO2Max_estimated: vEst?.data,
        body_fat_pct: bFat?.data,
        weight_kg: weight?.data,
        HR_max: hrMax?.data,
      };
      setLatest(map);
    } catch (e) {
      console.warn("[ProfileMetricInputs] bulk load failed", e);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadAllLatest(userId);
  }, [userId]);

  const ph = useMemo(() => buildMetricPlaceholders(t, latest), [latest, t]);
  const bmiText = useMemo(() => formatBmiFromLatest(latest), [latest]);

  function onChangeNumber<K extends EditableMetricKey>(key: K, raw: string) {
    setDirty((d) => ({ ...d, [key]: true }));
    setM((s) => ({ ...s, [key]: raw === "" ? null : Number(raw) }));
  }

  async function handleSave() {
    if (!userId) return;

    // Filtrujeme len tie, ktoré sa zmenili
    const toSave = (Object.keys(dirty) as EditableMetricKey[]).filter(k => dirty[k] && m[k] !== null);

    if (!toSave.length) {
      toast.error(t("performance.metrics.errorNoValues"));
      return;
    }

    setLoading(true);
    try {
      // Ukladáme postupne cez nové apiSaveMetric (podporuje 1 záznam)
      await Promise.all(
        toSave.map(k => apiSaveMetric(userId, k, Number(m[k])))
      );

      toast.success(t("performance.metrics.saveSuccess"));
      
      // Refresh dát
      await loadAllLatest(userId);

      // Reset stavu
      setM({ weight_kg: null, body_fat_pct: null, HR_max: null, VO2Max_measured: null, VO2Max_estimated: null });
      setDirty({ weight_kg: false, body_fat_pct: false, HR_max: false, VO2Max_measured: false, VO2Max_estimated: false });
      setOpen(false);
    } catch (e: any) {
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
        <Button size="sm" variant="primary" onClick={handleSave} disabled={loading || !userId}>
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
                value={m.VO2Max_estimated ?? ""}
                placeholder={ph.VO2Max_estimated || "AI Est."}
                onChange={(e) => onChangeNumber("VO2Max_estimated", e.target.value)}
                disabled={loading}
              />
              <TextField
                type="number"
                value={m.VO2Max_measured ?? ""}
                placeholder={ph.VO2Max_measured || "Watch"}
                onChange={(e) => onChangeNumber("VO2Max_measured", e.target.value)}
                disabled={loading}
              />
            </div>
          </section>

          {/* BMI (Read Only) */}
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
