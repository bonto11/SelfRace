// src/app/features/performance/components/DetailBodyScan.tsx
"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import DateField from "@/app/shared/ui/components/DateField";
import NumberField from "@/app/shared/ui/components/NumberField";
import SelectField from "@/app/shared/ui/components/SelectField";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmtDate } from "@/app/shared/utils/time";
import {
  apiUploadBodyScan,
  apiConfirmBodyScan,
  apiCreateManualBodyScan,
  apiGetBodyScansForTrend,
  apiDeleteBodyScan,
} from "@/app/features/performance/api/bodyScan";
import type {
  BodyScan,
  BodyScanUploadResult,
  SegmentalAnalysis,
  SegmentalPart,
} from "@/app/features/performance/types/bodyScan";
import BodyScanVisualization, { evalLabelKey } from "@/app/features/performance/components/BodyScanVisualization";

/* ============================================================ */
/* REVIEW SECTIONS - rozdelené presne podľa kategórií z InBody fotky */
/* (rozsahy min/max sa NEZOBRAZUJU tu - su to referencne hodnoty */
/* z papiera, automaticky ulozene AI extrakciou, nie na upravu) */
/* ============================================================ */

type ReviewFieldDef = { key: keyof BodyScan; labelKey: string; unit?: string };
type ReviewSection = { titleKey: string; fields: ReviewFieldDef[] };

const REVIEW_SECTIONS: ReviewSection[] = [
  {
    titleKey: "bodyScan.sections.bodyComposition",
    fields: [
      { key: "total_body_water_l", labelKey: "bodyScan.fields.totalBodyWater", unit: "l" },
      { key: "protein_kg", labelKey: "bodyScan.fields.protein", unit: "kg" },
      { key: "mineral_kg", labelKey: "bodyScan.fields.mineral", unit: "kg" },
      { key: "body_fat_mass_kg", labelKey: "bodyScan.fields.bodyFatMass", unit: "kg" },
      { key: "weight_kg", labelKey: "bodyScan.fields.weight", unit: "kg" },
    ],
  },
  {
    titleKey: "bodyScan.sections.muscleFat",
    fields: [
      { key: "skeletal_muscle_mass_kg", labelKey: "bodyScan.fields.smm", unit: "kg" },
    ],
  },
  {
    titleKey: "bodyScan.sections.obesity",
    fields: [
      { key: "bmi", labelKey: "bodyScan.fields.bmi" },
      { key: "pbf_percent", labelKey: "bodyScan.fields.pbf", unit: "%" },
    ],
  },
  {
    titleKey: "bodyScan.sections.other",
    fields: [
      { key: "waist_hip_ratio", labelKey: "bodyScan.fields.waistHipRatio" },
      { key: "visceral_fat_level", labelKey: "bodyScan.fields.visceralFatLevel" },
      { key: "basal_metabolic_rate_kcal", labelKey: "bodyScan.fields.bmr", unit: "kcal" },
      { key: "inbody_score", labelKey: "bodyScan.fields.inbodyScore" },
      { key: "obesity_degree_percent", labelKey: "bodyScan.fields.obesityDegree", unit: "%" },
      { key: "smi", labelKey: "bodyScan.fields.smi" },
    ],
  },
];

const ALL_REVIEW_FIELDS: ReviewFieldDef[] = REVIEW_SECTIONS.flatMap((s) => s.fields);

const SEGMENT_LABEL_KEYS: {
  key: "left_arm" | "right_arm" | "trunk" | "left_leg" | "right_leg";
  labelKey: string;
}[] = [
  { key: "left_arm", labelKey: "bodyScan.segments.leftArm" },
  { key: "right_arm", labelKey: "bodyScan.segments.rightArm" },
  { key: "trunk", labelKey: "bodyScan.segments.trunk" },
  { key: "left_leg", labelKey: "bodyScan.segments.leftLeg" },
  { key: "right_leg", labelKey: "bodyScan.segments.rightLeg" },
];

const EMPTY_SEGMENTAL: SegmentalAnalysis = {
  lean: {
    left_arm: { kg: null, pct: null, eval: null },
    right_arm: { kg: null, pct: null, eval: null },
    trunk: { kg: null, pct: null, eval: null },
    left_leg: { kg: null, pct: null, eval: null },
    right_leg: { kg: null, pct: null, eval: null },
  },
  fat: {
    left_arm: { kg: null, pct: null, eval: null },
    right_arm: { kg: null, pct: null, eval: null },
    trunk: { kg: null, pct: null, eval: null },
    left_leg: { kg: null, pct: null, eval: null },
    right_leg: { kg: null, pct: null, eval: null },
  },
};

/* ─── EDITOVATEĽNÁ SEGMENTÁLNA SEKCIA ─── */

function SegmentalEditSection({
  title,
  values,
  onChange,
}: {
  title: string;
  values: Record<string, SegmentalPart>;
  onChange: (key: string, part: SegmentalPart) => void;
}) {
  const t = useT();
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: appColors.textPrimary, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {SEGMENT_LABEL_KEYS.map(({ key, labelKey }) => {
          const seg = values[key] ?? { kg: null, pct: null, eval: null };
          return (
            <div
              key={key}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: appColors.backgroundAlt,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, color: appColors.textMuted }}>{t(labelKey as any)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <NumberField
                  value={seg.kg}
                  onChange={(v) => onChange(key, { ...seg, kg: v })}
                  unit="kg"
                  variant="editable"
                />
                <NumberField
                  value={seg.pct}
                  onChange={(v) => onChange(key, { ...seg, pct: v })}
                  unit="%"
                  variant="editable"
                />
              </div>
              <SelectField
                value={seg.eval ?? ""}
                onChange={(e: any) => {
                  const v = e?.target?.value ?? e;
                  onChange(key, { ...seg, eval: v || null });
                }}
                options={[
                  { value: "", label: "—" },
                  { value: "Under", label: t("bodyScan.eval.under") },
                  { value: "Normal", label: t("bodyScan.eval.normal") },
                  { value: "Over", label: t("bodyScan.eval.over") },
                ]}
                variant="editable"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── REVIEW / MANUAL ENTRY PANEL ─── */

function ReviewPanel({
  draft,
  onCancel,
  onConfirm,
  confirming,
  isManual,
}: {
  draft: BodyScanUploadResult;
  onCancel: () => void;
  onConfirm: (corrections: Partial<BodyScan>) => void;
  confirming: boolean;
  isManual?: boolean;
}) {
  const t = useT();
  const [values, setValues] = React.useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const f of ALL_REVIEW_FIELDS) {
      const v = draft.scan[f.key];
      init[f.key as string] = typeof v === "number" ? v : null;
    }
    return init;
  });
  const [scanDate, setScanDate] = React.useState<string>(draft.scan.scan_date ?? "");

  const [segmental, setSegmental] = React.useState<SegmentalAnalysis>(
    draft.scan.segmental_analysis ?? EMPTY_SEGMENTAL,
  );

  const unreadable = new Set(draft.unreadable_fields ?? []);

  const handleChange = (key: string, val: number | null) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSegmentChange = (
    kind: "lean" | "fat",
    key: string,
    part: SegmentalPart,
  ) => {
    setSegmental((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [key]: part },
    }));
  };

  const handleSubmit = () => {
    const corrections: Partial<BodyScan> = {};
    for (const f of ALL_REVIEW_FIELDS) {
      corrections[f.key] = values[f.key as string] as any;
    }
    if (scanDate) {
      corrections.scan_date = scanDate;
    }
    corrections.segmental_analysis = segmental;
    onConfirm(corrections);
  };

  return (
    <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginBottom: 12 }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
          {isManual ? t("bodyScan.manual.title") : t("bodyScan.review.title")}
        </div>
        <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 4 }}>
          {isManual
            ? t("bodyScan.manual.hint")
            : draft.extraction_confidence === "low"
              ? t("bodyScan.review.lowConfidenceHint")
              : t("bodyScan.review.hint")}
        </div>
      </div>

      
