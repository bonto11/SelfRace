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
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmtDate } from "@/app/shared/utils/time";
import {
  apiUploadBodyScan,
  apiConfirmBodyScan,
  apiEditBodyScan,
  apiGetBodyScansForTrend,
  apiDeleteBodyScan,
} from "@/app/features/performance/api/bodyScan";
import type {
  BodyScan,
  BodyScanUploadResult,
} from "@/app/features/performance/types/bodyScan";

/* ─── EDITABLE FIELD ROW (review pred potvrdením) ─── */

const REVIEW_FIELDS: { key: keyof BodyScan; label: string; unit?: string }[] = [
  { key: "weight_kg", label: "Váha", unit: "kg" },
  { key: "bmi", label: "BMI" },
  { key: "pbf_percent", label: "PBF", unit: "%" },
  { key: "skeletal_muscle_mass_kg", label: "SMM", unit: "kg" },
  { key: "body_fat_mass_kg", label: "Tuk", unit: "kg" },
  { key: "total_body_water_l", label: "Voda", unit: "l" },
  { key: "protein_kg", label: "Proteín", unit: "kg" },
  { key: "mineral_kg", label: "Minerály", unit: "kg" },
  { key: "waist_hip_ratio", label: "Waist-Hip Ratio" },
  { key: "visceral_fat_level", label: "Viscerálny tuk" },
  { key: "basal_metabolic_rate_kcal", label: "BMR", unit: "kcal" },
  { key: "inbody_score", label: "InBody Score" },
  { key: "obesity_degree_percent", label: "Obesity Degree", unit: "%" },
  { key: "smi", label: "SMI" },
];

function ReviewPanel({
  draft,
  onCancel,
  onConfirm,
  confirming,
}: {
  draft: BodyScanUploadResult;
  onCancel: () => void;
  onConfirm: (corrections: Partial<BodyScan>) => void;
  confirming: boolean;
}) {
  const t = useT();
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      scan_date: draft.scan.scan_date ?? "",
    };
    for (const f of REVIEW_FIELDS) {
      const v = draft.scan[f.key];
      init[f.key as string] = v == null ? "" : String(v);
    }
    return init;
  });

  const unreadable = new Set(draft.unreadable_fields ?? []);

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = () => {
    const corrections: Partial<BodyScan> = {};
    for (const f of REVIEW_FIELDS) {
      const raw = values[f.key as string];
      const num = raw === "" ? null : Number(raw);
      corrections[f.key] = (Number.isFinite(num as number) ? num : null) as any;
    }
    if (values.scan_date) {
      corrections.scan_date = values.scan_date;
    }
    onConfirm(corrections);
  };

  return (
    <section
      className={CARD}
      style={{ ...SURFACE_CARD_STYLE, marginBottom: 12 }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: appColors.textPrimary,
          }}
        >
          {t("bodyScan.review.title")}
        </div>
        <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 4 }}>
          {draft.extraction_confidence === "low"
            ? t("bodyScan.review.lowConfidenceHint")
            : t("bodyScan.review.hint")}
        </div>
      </div>

      <div
        style={{
          padding: "0 16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div>
          <label
            style={{
              fontSize: 11,
              color: appColors.textMuted,
              display: "block",
              marginBottom: 4,
            }}
          >
            {t("bodyScan.review.scanDate")}
          </label>
          <input
            type="date"
            value={values.scan_date}
            onChange={(e) => handleChange("scan_date", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              background: appColors.backgroundAlt,
              border: `1px solid ${appColors.surfaceCardBorder}`,
              color: appColors.textPrimary,
              fontSize: 13,
            }}
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {REVIEW_FIELDS.map((f) => {
            const isUnreadable = unreadable.has(f.key as string);
            return (
              <div key={f.key as string}>
                <label
                  style={{
                    fontSize: 11,
                    color: isUnreadable ? "#f59e0b" : appColors.textMuted,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {f.label} {f.unit ? `(${f.unit})` : ""} {isUnreadable && "⚠️"}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[f.key as string]}
                  onChange={(e) =>
                    handleChange(f.key as string, e.target.value)
                  }
                  placeholder="—"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: appColors.backgroundAlt,
                    border: `1px solid ${
                      isUnreadable ? "#f59e0b55" : appColors.surfaceCardBorder
                    }`,
                    color: appColors.textPrimary,
                    fontSize: 13,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={confirming}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={confirming}
            className="flex-1"
          >
            {confirming ? (
              <LoadingSpinner size="button" />
            ) : (
              t("bodyScan.review.confirm")
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── TREND CHART ─── */

function BodyScanTrendChart({ scans }: { scans: BodyScan[] }) {
  const t = useT();

  const chartData = React.useMemo(
    () =>
      scans.map((s) => ({
        date: fmtDate(s.scan_date),
        weight: s.weight_kg,
        pbf: s.pbf_percent,
      })),
    [scans],
  );

  if (chartData.length < 2) return null;

  return (
    <section
      className={CARD}
      style={{ ...SURFACE_CARD_STYLE, marginBottom: 12, padding: "14px 16px" }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: appColors.textMuted,
          marginBottom: 8,
        }}
      >
        {t("bodyScan.trendTitle")}
      </div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={appColors.divider}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: appColors.textMuted }}
              axisLine={{ stroke: appColors.divider }}
              tickLine={false}
            />
            <YAxis
              yAxisId="weight"
              tick={{ fontSize: 10, fill: appColors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <YAxis
              yAxisId="pbf"
              orientation="right"
              tick={{ fontSize: 10, fill: appColors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: appColors.backgroundAlt,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              stroke={appColors.chartRun}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="pbf"
              type="monotone"
              dataKey="pbf"
              stroke={appColors.chartBike}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 2,
              background: appColors.chartRun,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 11, color: appColors.textMuted }}>
            {t("bodyScan.chartWeight")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 2,
              background: appColors.chartBike,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 11, color: appColors.textMuted }}>
            {t("bodyScan.chartPbf")}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── HISTÓRIA ─── */

function HistoryRow({
  scan,
  onDelete,
}: {
  scan: BodyScan;
  onDelete: (id: number) => void;
}) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        borderTop: `1px solid ${appColors.divider}`,
      }}
    >
      <span style={{ fontSize: 13, color: appColors.textMuted }}>
        {fmtDate(scan.scan_date)}
      </span>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        {scan.weight_kg != null && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: appColors.textPrimary,
            }}
          >
            {scan.weight_kg.toFixed(1)} kg
          </span>
        )}
        {scan.pbf_percent != null && (
          <span style={{ fontSize: 12, color: appColors.textMuted }}>
            {scan.pbf_percent.toFixed(1)}% PBF
          </span>
        )}
        <button
          type="button"
          onClick={() => onDelete(scan.id)}
          style={{
            fontSize: 14,
            opacity: 0.5,
            background: "none",
            border: "none",
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */

export default function DetailBodyScan() {
  const { userId } = useUserId();
  const t = useT();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = React.useState(false);
  const [draft, setDraft] = React.useState<BodyScanUploadResult | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const [scans, setScans] = React.useState<BodyScan[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadScans = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rows = await apiGetBodyScansForTrend(Number(userId));
      setScans(rows);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    setUploading(true);
    try {
      const result = await apiUploadBodyScan(Number(userId), file);
      if (!result) {
        toast.error(t("bodyScan.errorUpload"));
        return;
      }
      setDraft(result);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async (corrections: Partial<BodyScan>) => {
    if (!userId || !draft) return;
    setConfirming(true);
    try {
      const scan = await apiConfirmBodyScan(
        Number(userId),
        draft.scan.id,
        corrections,
      );
      if (!scan) {
        toast.error(t("bodyScan.errorConfirm"));
        return;
      }
      toast.success(t("bodyScan.confirmSuccess"));
      setDraft(null);
      await loadScans();
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async (scanId: number) => {
    if (!userId) return;
    const ok = await apiDeleteBodyScan(Number(userId), scanId);
    if (ok) {
      toast.success(t("common.done"));
      await loadScans();
    } else {
      toast.error(t("common.error"));
    }
  };

  const latestScan = scans[scans.length - 1] ?? null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      {!draft && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full mb-3"
        >
          {uploading ? (
            <LoadingSpinner size="button" />
          ) : (
            t("bodyScan.uploadButton")
          )}
        </Button>
      )}

      {draft && (
        <ReviewPanel
          draft={draft}
          onCancel={() => setDraft(null)}
          onConfirm={handleConfirm}
          confirming={confirming}
        />
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <LoadingSpinner size="trend" />
        </div>
      ) : (
        <>
          <BodyScanTrendChart scans={scans} />

          <section className={CARD} style={SURFACE_CARD_STYLE}>
            <div
              style={{
                padding: "12px 16px 8px",
                fontSize: 12,
                fontWeight: 700,
                color: appColors.textMuted,
              }}
            >
              {t("bodyScan.historyTitle")}
            </div>
            {scans.length === 0 ? (
              <p
                style={{
                  padding: "0 16px 16px",
                  fontSize: 13,
                  color: appColors.textMuted,
                }}
              >
                {t("bodyScan.widget.empty")}
              </p>
            ) : (
              [...scans]
                .reverse()
                .map((s) => (
                  <HistoryRow key={s.id} scan={s} onDelete={handleDelete} />
                ))
            )}
          </section>
        </>
      )}
    </>
  );
}
