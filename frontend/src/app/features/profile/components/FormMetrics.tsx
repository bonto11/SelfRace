// src/features/profile/components/FormMetrics.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/components/ui/Button";
import { Plus, Minus } from "lucide-react";
import { toast } from "@/app/shared/components/ui/Toast";
import { inputClass, labelClass } from "@/app/shared/ui";

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

import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_LIST,
  PANEL_LIST_ITEM,
  PANEL_ACTION_ROW,
  ICON_BUTTON,
} from "@/app/shared/ui/tokens";

function SummaryRow({ k, v, extra }: { k: string; v: string; extra?: string }) {
  return (
    <div className={PANEL_LIST_ITEM}>
      <span className="opacity-70">{k}</span>
      <span className="font-medium">
        {v}
        {extra ? <span className="opacity-60 ml-1">({extra})</span> : null}
      </span>
    </div>
  );
}

const UNIT_MAP: Record<EditableMetricKey, string> = {
  weight_kg: "kg",
  body_fat_pct: "%",
  HR_max: "bpm",
  VO2Max_measured: "mL/kg/min",
  VO2Max_estimated: "mL/kg/min",
};

export default function FormMetrics() {
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
        if (alive) setLatest(data);
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
    if (!userId) return;

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
      toast.success(`✅ Uložené${res.inserted ? ` (${res.inserted})` : ""}`);

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
      toast.error(`❌ Chyba: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={SURFACE_CARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_CARD_HEAD}>
          <h2 className={PANEL_CARD_TITLE}>Metrics</h2>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={ICON_BUTTON}
            aria-label={open ? "Zbaliť" : "Rozbaliť"}
            title={open ? "Zbaliť" : "Rozbaliť"}
          >
            {open ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {!open ? (
          <div className={PANEL_LIST}>
            <SummaryRow
              k="Weight"
              v={
                Number.isFinite(latest?.weight_kg?.value as number)
                  ? `${latest?.weight_kg?.value} kg`
                  : "—"
              }
              extra={formatMetricDate(latest?.weight_kg?.updated_at)}
            />
            <SummaryRow
              k="Body fat %"
              v={
                Number.isFinite(latest?.body_fat_pct?.value as number)
                  ? `${latest?.body_fat_pct?.value}%`
                  : "—"
              }
              extra={formatMetricDate(latest?.body_fat_pct?.updated_at)}
            />
            <SummaryRow
              k="HR max"
              v={
                Number.isFinite(latest?.HR_max?.value as number)
                  ? `${latest?.HR_max?.value} bpm`
                  : "—"
              }
              extra={formatMetricDate(latest?.HR_max?.updated_at)}
            />
            <SummaryRow
              k="VO₂Max (measured)"
              v={
                Number.isFinite(latest?.VO2Max_measured?.value as number)
                  ? `${latest?.VO2Max_measured?.value} mL/kg/min`
                  : "—"
              }
              extra={formatMetricDate(latest?.VO2Max_measured?.updated_at)}
            />
            <SummaryRow
              k="VO₂Max (estimated)"
              v={
                Number.isFinite(latest?.VO2Max_estimated?.value as number)
                  ? `${latest?.VO2Max_estimated?.value} mL/kg/min`
                  : "—"
              }
              extra={formatMetricDate(latest?.VO2Max_estimated?.updated_at)}
            />
            <SummaryRow
              k="BMI"
              v={bmiText}
              extra={formatMetricDate(latest?.BMI?.updated_at)}
            />
          </div>
        ) : (
          <div className={["grid gap-3 md:grid-cols-3", "items-start"].join(" ")}>
            <div>
              <label className={[labelClass, "block mb-1"].join(" ")}>
                Weight <span className="opacity-60">(kg)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={m.weight_kg ?? ""}
                placeholder={ph.weight_kg}
                onChange={(e) => onChangeNumber("weight_kg", e.target.value)}
                className={[inputClass, "h-9 text-sm text-center"].join(" ")}
              />
            </div>

            <div>
              <label className={[labelClass, "block mb-1"].join(" ")}>
                Body fat <span className="opacity-60">(%)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={m.body_fat_pct ?? ""}
                placeholder={ph.body_fat_pct}
                onChange={(e) => onChangeNumber("body_fat_pct", e.target.value)}
                className={[inputClass, "h-9 text-sm text-center"].join(" ")}
              />
            </div>

            <div>
              <label className={[labelClass, "block mb-1"].join(" ")}>
                HR max <span className="opacity-60">(bpm)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={m.HR_max ?? ""}
                placeholder={ph.HR_max}
                onChange={(e) => onChangeNumber("HR_max", e.target.value)}
                className={[inputClass, "h-9 text-sm text-center"].join(" ")}
              />
            </div>

            <div>
              <label className={[labelClass, "block mb-1"].join(" ")}>
                VO₂Max (measured){" "}
                <span className="opacity-60">(mL/kg/min)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={m.VO2Max_measured ?? ""}
                placeholder={ph.VO2Max_measured}
                onChange={(e) =>
                  onChangeNumber("VO2Max_measured", e.target.value)
                }
                className={[inputClass, "h-9 text-sm text-center"].join(" ")}
              />
            </div>

            <div>
              <label className={[labelClass, "block mb-1"].join(" ")}>
                VO₂Max (estimated){" "}
                <span className="opacity-60">(mL/kg/min)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={m.VO2Max_estimated ?? ""}
                placeholder={ph.VO2Max_estimated}
                onChange={(e) =>
                  onChangeNumber("VO2Max_estimated", e.target.value)
                }
                className={[inputClass, "h-9 text-sm text-center"].join(" ")}
              />
            </div>

            <div className={PANEL_ACTION_ROW}>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Ukladám…" : "Save new entry"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}