"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { toast } from "@/app/shared/ui/components/Toast";

import {
  apiGetLatestMetrics,
  apiSaveMetrics,
} from "@/app/features/profile/api/metrics";
import type {
  LatestMetricsMap,
  MetricKey,
  EditableMetricKey,
  MetricState,
  DirtyMap,
} from "@/app/features/profile/types/profile";
import {
  buildMetricPlaceholders,
  formatBmiFromLatest,
} from "@/app/features/profile/utils/profile";
import { formatMetricDate } from "@/app/shared/utils/time";
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
import { useT } from "@/app/shared/i18n/useT"; // 1. Import hooku

const UNIT_MAP: Record<EditableMetricKey, string> = {
  weight_kg: "kg",
  body_fat_pct: "%",
  HR_max: "bpm",
  VO2Max_measured: "ml/kg/min",
  VO2Max_estimated: "ml/kg/min",
};

export default function ProfileMetricInputs() {
  const { userId } = useUserId() as { userId: number | null };
  const t = useT(); // 2. Inicializácia t

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

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const data = await apiGetLatestMetrics(userId);
        if (!alive) return;
        setLatest(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ph = useMemo(() => buildMetricPlaceholders(t, latest), [latest]);
  const bmiText = useMemo(() => formatBmiFromLatest(latest), [latest]);

  function onChangeNumber<K extends EditableMetricKey>(key: K, raw: string) {
    setDirty((d) => ({ ...d, [key]: true }));
    setM((s) => ({ ...s, [key]: raw === "" ? null : Number(raw) }));
  }

  async function handleSave() {
    if (!userId) {
      toast.error(t("common.errors.missingUser"));
      return;
    }

    const entries = (Object.keys(UNIT_MAP) as EditableMetricKey[])
      .filter((k) => dirty[k])
      .filter((k) => Number.isFinite(m[k] as number))
      .map((k) => ({
        metric: k as MetricKey,
        value_num: Number(m[k] as number),
        unit: UNIT_MAP[k],
        measured_at: new Date().toISOString(),
        source: "user",
      }));

    if (!entries.length) {
      toast.error(t("profile.metrics.errorNoValues"));
      return;
    }

    try {
      setLoading(true);
      const res = await apiSaveMetrics(userId, entries);
      // UX: Preložený úspech s počtom uložených hodnôt
      toast.success(`${t("profile.metrics.saveSuccess")}${res.inserted ? ` (${res.inserted})` : ""}`);

      const data = await apiGetLatestMetrics(userId);
      setLatest(data);

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
    } catch (e: any) {
      toast.error(`${t("common.errors.errorPrefix")}${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  const previewText = useMemo(() => {
    const w = Number.isFinite(latest?.weight_kg?.value as number)
      ? `${latest?.weight_kg?.value} kg (${formatMetricDate(
          latest?.weight_kg?.updated_at,
        )})`
      : "—";
    const bf = Number.isFinite(latest?.body_fat_pct?.value as number)
      ? `${latest?.body_fat_pct?.value}% (${formatMetricDate(
          latest?.body_fat_pct?.updated_at,
        )})`
      : "—";
    const hr = Number.isFinite(latest?.HR_max?.value as number)
      ? `${latest?.HR_max?.value} bpm (${formatMetricDate(
          latest?.HR_max?.updated_at,
        )})`
      : "—";
    const vo2 = Number.isFinite(latest?.VO2Max_estimated?.value as number)
      ? `${latest?.VO2Max_estimated?.value}`
      : "—";
    
    // Použitie preložených labelov v náhľade
    return `${t("profile.metrics.previewWeight")}: ${w} • ${t("profile.metrics.previewFat")}: ${bf} • ${t("profile.metrics.previewHrMax")}: ${hr} • VO₂Max: ${vo2}`;
  }, [latest, t]);

  return (
    <InputsCard
      title={t("profile.metrics.title")}
      subtitle={t("profile.metrics.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
      actions={
        <Button
          size="sm"
          variant="secondary"
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
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.metrics.weightLabel")}
            </div>
            <TextField
              type="number"
              inputMode="decimal"
              value={m.weight_kg ?? ""}
              placeholder={ph.weight_kg || "kg"}
              onChange={(e) => onChangeNumber("weight_kg", e.target.value)}
              disabled={loading}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.metrics.fatLabel")}
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

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.metrics.hrMaxLabel")}
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

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("VO2Max.title")}
            </div>
            <div className={FORM_GRID_SPLIT}>
              <TextField
                type="number"
                inputMode="decimal"
                value={m.VO2Max_estimated ?? ""}
                placeholder={ph.VO2Max_estimated || t("profile.metrics.estimatedPlaceholder")}
                onChange={(e) =>
                  onChangeNumber("VO2Max_estimated", e.target.value)
                }
                disabled={loading}
              />
              <TextField
                type="number"
                inputMode="decimal"
                value={m.VO2Max_measured ?? ""}
                placeholder={ph.VO2Max_measured || t("profile.metrics.measuredPlaceholder")}
                onChange={(e) =>
                  onChangeNumber("VO2Max_measured", e.target.value)
                }
                disabled={loading}
              />
            </div>
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("profile.metrics.bmiLabel")}
            </div>
            <TextField value={bmiText || "—"} disabled />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("common.soon") /* Použité z common */}
            </div>
            <TextField
              value={t("profile.metrics.saveTip")}
              disabled
            />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}