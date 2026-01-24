// src/features/profile/components/ProfileMetricInputs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";

import TextField from "@/app/shared/components/ui/TextField";
import { toast } from "@/app/shared/components/ui/Toast";

import InputsCard from "@/app/shared/components/ui/InputsCard";

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

const UNIT_MAP: Record<EditableMetricKey, string> = {
  weight_kg: "kg",
  body_fat_pct: "%",
  HR_max: "bpm",
  VO2Max_measured: "mL/kg/min",
  VO2Max_estimated: "mL/kg/min",
};

export default function ProfileMetricInputs() {
  const { userId } = useUserId() as { userId: number | null };

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

  const ph = useMemo(() => buildMetricPlaceholders(latest), [latest]);
  const bmiText = useMemo(() => formatBmiFromLatest(latest), [latest]);

  function onChangeNumber<K extends EditableMetricKey>(key: K, raw: string) {
    setDirty((d) => ({ ...d, [key]: true }));
    setM((s) => ({ ...s, [key]: raw === "" ? null : Number(raw) }));
  }

  async function handleSave() {
    if (!userId) {
      toast.error("Chýba používateľ.");
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
      toast.error("Zadaj aspoň jednu novú hodnotu.");
      return;
    }

    try {
      setLoading(true);
      const res = await apiSaveMetrics(userId, entries);
      toast.success(`Uložené${res.inserted ? ` (${res.inserted})` : ""}`);

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
      toast.error("Chyba: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const previewText = useMemo(() => {
    const w = Number.isFinite(latest?.weight_kg?.value as number)
      ? `${latest?.weight_kg?.value} kg (${formatMetricDate(
          latest?.weight_kg?.updated_at
        )})`
      : "—";
    const bf = Number.isFinite(latest?.body_fat_pct?.value as number)
      ? `${latest?.body_fat_pct?.value}% (${formatMetricDate(
          latest?.body_fat_pct?.updated_at
        )})`
      : "—";
    const hr = Number.isFinite(latest?.HR_max?.value as number)
      ? `${latest?.HR_max?.value} bpm (${formatMetricDate(
          latest?.HR_max?.updated_at
        )})`
      : "—";
    const vo2 = Number.isFinite(latest?.VO2Max_estimated?.value as number)
      ? `${latest?.VO2Max_estimated?.value}`
      : "—";
    return `Hmotnosť: ${w} • Tuk: ${bf} • HR max: ${hr} • VO₂Max: ${vo2}`;
  }, [latest]);

  return (
    <InputsCard
      title="Metriky"
      subtitle="Hmotnosť, tuk, HR max a VO₂Max."
      previewText={previewText}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      saving={loading}
      onSave={handleSave}
      saveLabel={loading ? "Ukladám…" : "Uložiť"}
      saveDisabled={loading || !userId}
    >
      <InputsCard.Grid>
        <InputsCard.Field label="Hmotnosť">
          <TextField
            type="number"
            inputMode="decimal"
            value={m.weight_kg ?? ""}
            placeholder={ph.weight_kg || "kg"}
            onChange={(e) => onChangeNumber("weight_kg", e.target.value)}
            disabled={loading}
          />
        </InputsCard.Field>

        <InputsCard.Field label="Telesný tuk">
          <TextField
            type="number"
            inputMode="decimal"
            value={m.body_fat_pct ?? ""}
            placeholder={ph.body_fat_pct || "%"}
            onChange={(e) => onChangeNumber("body_fat_pct", e.target.value)}
            disabled={loading}
          />
        </InputsCard.Field>

        <InputsCard.Field label="HR max">
          <TextField
            type="number"
            inputMode="numeric"
            value={m.HR_max ?? ""}
            placeholder={ph.HR_max || "bpm"}
            onChange={(e) => onChangeNumber("HR_max", e.target.value)}
            disabled={loading}
          />
        </InputsCard.Field>

        <InputsCard.Field label="VO₂Max">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              type="number"
              inputMode="decimal"
              value={m.VO2Max_estimated ?? ""}
              placeholder={ph.VO2Max_estimated || "odhad"}
              onChange={(e) =>
                onChangeNumber("VO2Max_estimated", e.target.value)
              }
              disabled={loading}
            />
            <TextField
              type="number"
              inputMode="decimal"
              value={m.VO2Max_measured ?? ""}
              placeholder={ph.VO2Max_measured || "merané"}
              onChange={(e) =>
                onChangeNumber("VO2Max_measured", e.target.value)
              }
              disabled={loading}
            />
          </div>
        </InputsCard.Field>

        <InputsCard.Field label="BMI (výpočet)">
          <TextField value={bmiText || "—"} disabled />
        </InputsCard.Field>

        <InputsCard.Field label="Tip">
          <TextField
            value="Zadaj len to, čo chceš uložiť – ostatné nechaj prázdne."
            disabled
          />
        </InputsCard.Field>
      </InputsCard.Grid>
    </InputsCard>
  );
}