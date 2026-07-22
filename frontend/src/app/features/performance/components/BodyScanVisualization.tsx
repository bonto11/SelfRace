// src/app/features/performance/components/BodyScanVisualization.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import type {
  BodyScan,
  SegmentalPart,
} from "@/app/features/performance/types/bodyScan";

/* ============================================================ */
/* HELPERS - case-insensitive preklad eval labelu cez i18n katalóg */
/* ============================================================ */

export function evalLabelKey(
  evalLabel: string | null,
):
  | "bodyScan.eval.under"
  | "bodyScan.eval.normal"
  | "bodyScan.eval.over"
  | null {
  const l = (evalLabel || "").trim().toLowerCase();
  if (l === "under") return "bodyScan.eval.under";
  if (l === "over") return "bodyScan.eval.over";
  if (l === "normal") return "bodyScan.eval.normal";
  return null;
}

/* ============================================================ */
/* HORIZONTÁLNY BAR (Under / Normal / Over škála, presne ako InBody) */
/* ============================================================ */

// Nahraď typ a funkciu ScaleBar v BodyScanVisualization.tsx týmto:

type BarProps = {
  label: string;
  value: number | null;
  normalMin: number | null;
  normalMax: number | null;
  unit?: string;
  /**
   * "center" (default) = ísť mimo normal rozsahu (hocktorým smerom) je zle,
   *   napr. Váha, Telesný tuk, BMI, PBF.
   * "higher_better" = nad normal rozsahom je DOBRE (zelené), pod je zle,
   *   napr. SMM (kostrové svalstvo) - viac svalov nie je problém.
   */
  direction?: "center" | "higher_better";
};

function ScaleBar({
  label,
  value,
  normalMin,
  normalMax,
  unit = "",
  direction = "center",
}: BarProps) {
  const t = useT();
  if (value == null || normalMin == null || normalMax == null) return null;

  // Defenzíva: ak AI extrakcia omylom vráti min/max obrátene, opravíme poradie
  const realMin = Math.min(normalMin, normalMax);
  const realMax = Math.max(normalMin, normalMax);

  const scaleMax = Math.max(realMax * 1.6, value * 1.15);
  const pct = (v: number) => Math.min(100, Math.max(0, (v / scaleMax) * 100));

  const normalStartPct = pct(realMin);
  const normalEndPct = pct(realMax);
  const valuePct = pct(value);

  const statusEn: "Under" | "Normal" | "Over" =
    value < realMin ? "Under" : value > realMax ? "Over" : "Normal";

  const statusColor =
    statusEn === "Normal"
      ? "#4ade80"
      : direction === "higher_better"
        ? statusEn === "Over"
          ? "#4ade80" // viac ako priemer = dobre (napr. SMM)
          : "#f97316" // menej ako priemer = zle
        : statusEn === "Under"
          ? "#facc15"
          : "#f97316";

  const statusKey = evalLabelKey(statusEn)!;
  const statusLabel = t(statusKey as any);

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: appColors.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: statusColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {value}
          {unit} · {statusLabel}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 4,
          background: appColors.backgroundAlt,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${normalStartPct}%`,
            width: `${normalEndPct - normalStartPct}%`,
            top: 0,
            bottom: 0,
            background: "#4ade8033",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${valuePct}% - 2px)`,
            width: 4,
            top: -2,
            bottom: -2,
            borderRadius: 2,
            background: statusColor,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <span style={{ fontSize: 10, color: appColors.textMuted }}>0</span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {normalMin}–{normalMax} ({t("bodyScan.average")})
        </span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {Math.round(scaleMax)}
        </span>
      </div>
    </div>
  );
}

/* ============================================================ */
/* VISCERAL FAT (samostatná škála 1-20, Low-High) */
/* ============================================================ */

function VisceralFatBar({ level }: { level: number | null }) {
  const t = useT();
  if (level == null) return null;
  const maxScale = 20;
  const pct = Math.min(100, (level / maxScale) * 100);
  const color = level <= 9 ? "#4ade80" : level <= 14 ? "#facc15" : "#f97316";

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: appColors.textPrimary,
          }}
        >
          {t("bodyScan.visceralFat")}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{level}</span>
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 4,
          background:
            "linear-gradient(to right, #4ade8033 0%, #4ade8033 50%, #f9731633 50%, #f9731633 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 2px)`,
            width: 4,
            top: -2,
            bottom: -2,
            borderRadius: 2,
            background: color,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {t("bodyScan.low")}
        </span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>10</span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {t("bodyScan.high")}
        </span>
      </div>
    </div>
  );
}

/* ============================================================ */
/* INBODY SCORE BADGE */
/* ============================================================ */

function ScoreBadge({ score }: { score: number | null }) {
  const t = useT();
  if (score == null) return null;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : "#f97316";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderRadius: 10,
        background: appColors.backgroundAlt,
        border: `1px solid ${appColors.surfaceCardBorder}`,
        marginBottom: 14,
      }}
    >
      <span
        style={{ fontSize: 12, fontWeight: 700, color: appColors.textMuted }}
      >
        {t("bodyScan.inbodyScore")}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color }}>
        {score}
        <span
          style={{ fontSize: 12, fontWeight: 500, color: appColors.textMuted }}
        >
          /100
        </span>
      </span>
    </div>
  );
}

/* ============================================================ */
/* PANÁČIK (segmentálna analýza) - ruky v tvare "/ | \" (dole šikmo) */
/* ============================================================ */

function segmentColor(evalLabel: string | null, kind: "lean" | "fat"): string {
  const l = (evalLabel || "").trim().toLowerCase();
  if (l === "normal" || l === "") return appColors.textPrimary;
  if (kind === "lean") {
    return l === "over" ? "#4ade80" : "#f97316";
  }
  return l === "under" ? "#4ade80" : "#f97316";
}

function BodyDiagram({
  segments,
  kind,
}: {
  segments: Record<string, SegmentalPart> | undefined;
  kind: "lean" | "fat";
}) {
  const t = useT();
  if (!segments) return null;

  const renderLabel = (
    key: "left_arm" | "right_arm" | "trunk" | "left_leg" | "right_leg",
    labelKey: string,
    x: number,
    y: number,
    anchor: "start" | "middle" | "end",
  ) => {
    const seg = segments[key];
    if (!seg) return null;
    const color = segmentColor(seg.eval, kind);
    const statusKey = evalLabelKey(seg.eval);

    return (
      <g>
        <text
          x={x}
          y={y}
          fontSize="9"
          fontWeight={700}
          textAnchor={anchor}
          fill={appColors.textMuted}
          style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}
        >
          {t(labelKey as any)}
        </text>
        <text
          x={x}
          y={y + 13}
          fontSize="13"
          fontWeight={800}
          textAnchor={anchor}
          fill={color}
        >
          {seg.kg != null ? `${seg.kg}kg` : "—"}
        </text>
        {statusKey && (
          <text
            x={x}
            y={y + 26}
            fontSize="9"
            fontWeight={600}
            textAnchor={anchor}
            fill={color}
          >
            {t(statusKey as any)}
          </text>
        )}
      </g>
    );
  };

  return (
    <div
      style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}
    >
      <svg viewBox="0 0 260 260" width="260" height="260">
        {/* Hlava */}
        <circle cx="130" cy="24" r="14" fill={appColors.surfaceCardBorder} />
        {/* Trup */}
        <rect
          x="112"
          y="42"
          width="36"
          height="62"
          rx="10"
          fill={appColors.surfaceCardBorder}
        />
        {/* Ľavá ruka - vodorovne von od tela ("-" tvar, otočené o 90° oproti predošlej verzii) */}
        <rect
          x="60"
          y="48"
          width="50"
          height="14"
          rx="7"
          fill={appColors.surfaceCardBorder}
        />
        {/* Pravá ruka */}
        <rect
          x="150"
          y="48"
          width="50"
          height="14"
          rx="7"
          fill={appColors.surfaceCardBorder}
        />
        {/* Nohy */}
        <rect
          x="113"
          y="106"
          width="15"
          height="90"
          rx="7"
          fill={appColors.surfaceCardBorder}
        />
        <rect
          x="132"
          y="106"
          width="15"
          height="90"
          rx="7"
          fill={appColors.surfaceCardBorder}
        />
        {/* Popisky - na okrajoch, s label + kg + status */}
        {renderLabel("left_arm", "bodyScan.segments.leftArm", 55, 60, "middle")}
        {renderLabel(
          "right_arm",
          "bodyScan.segments.rightArm",
          205,
          60,
          "middle",
        )}
        {renderLabel("trunk", "bodyScan.segments.trunk", 130, 70, "middle")}
        {renderLabel(
          "left_leg",
          "bodyScan.segments.leftLeg",
          75,
          165,
          "middle",
        )}
        {renderLabel(
          "right_leg",
          "bodyScan.segments.rightLeg",
          185,
          165,
          "middle",
        )}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* HLAVNÝ EXPORT ============================================== */
/* ============================================================ */

export default function BodyScanVisualization({ scan }: { scan: BodyScan }) {
  const t = useT();
  const segmental = scan.segmental_analysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <ScoreBadge score={scan.inbody_score} />

      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: appColors.textMuted,
            marginBottom: 10,
          }}
        >
          {t("bodyScan.sections.muscleFat")}
        </div>
        <ScaleBar
          label={t("bodyScan.fields.weight")}
          value={scan.weight_kg}
          normalMin={scan.weight_range_min}
          normalMax={scan.weight_range_max}
          unit=" kg"
        />
        <ScaleBar
          label={t("bodyScan.fields.smmShort")}
          value={scan.skeletal_muscle_mass_kg}
          normalMin={scan.smm_range_min}
          normalMax={scan.smm_range_max}
          unit=" kg"
          direction="higher_better"
        />
        <ScaleBar
          label={t("bodyScan.fields.bodyFatMass")}
          value={scan.body_fat_mass_kg}
          normalMin={scan.body_fat_mass_range_min}
          normalMax={scan.body_fat_mass_range_max}
          unit=" kg"
        />
      </div>

      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: appColors.textMuted,
            marginBottom: 10,
          }}
        >
          {t("bodyScan.sections.obesity")}
        </div>
        <ScaleBar
          label="BMI"
          value={scan.bmi}
          normalMin={18.5}
          normalMax={25}
        />
        <ScaleBar
          label={t("bodyScan.fields.pbfShort")}
          value={scan.pbf_percent}
          normalMin={10}
          normalMax={20}
          unit="%"
        />
      </div>

      <VisceralFatBar level={scan.visceral_fat_level} />

      {segmental && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: appColors.textMuted,
              marginBottom: 4,
              textAlign: "center",
            }}
          >
            {t("bodyScan.sections.segmentalLean")}
          </div>
          <BodyDiagram segments={segmental.lean} kind="lean" />

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: appColors.textMuted,
              marginBottom: 4,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {t("bodyScan.sections.segmentalFat")}
          </div>
          <BodyDiagram segments={segmental.fat} kind="fat" />
        </div>
      )}
    </div>
  );
}
