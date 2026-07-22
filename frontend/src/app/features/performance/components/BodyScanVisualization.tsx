// src/app/features/performance/components/BodyScanVisualization.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import type { BodyScan, SegmentalPart } from "@/app/features/performance/types/bodyScan";

/* ============================================================ */
/* HORIZONTÁLNY BAR (Under / Normal / Over škála, presne ako InBody) */
/* ============================================================ */

type BarProps = {
  label: string;
  value: number | null;
  normalMin: number | null;
  normalMax: number | null;
  unit?: string;
};

function ScaleBar({ label, value, normalMin, normalMax, unit = "" }: BarProps) {
  if (value == null || normalMin == null || normalMax == null) return null;

  const scaleMax = Math.max(normalMax * 1.6, value * 1.15);
  const pct = (v: number) => Math.min(100, Math.max(0, (v / scaleMax) * 100));

  const normalStartPct = pct(normalMin);
  const normalEndPct = pct(normalMax);
  const valuePct = pct(value);

  const status =
    value < normalMin ? "Under" : value > normalMax ? "Over" : "Normal";
  const statusColor =
    status === "Normal" ? "#4ade80" : status === "Under" ? "#facc15" : "#f97316";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: appColors.textPrimary }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>
          {value}
          {unit} · {status}
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>0</span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {normalMin}–{normalMax} (priemer)
        </span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>{Math.round(scaleMax)}</span>
      </div>
    </div>
  );
}

/* ============================================================ */
/* VISCERAL FAT (samostatná škála 1-20, Low-High) */
/* ============================================================ */

function VisceralFatBar({ level }: { level: number | null }) {
  if (level == null) return null;
  const maxScale = 20;
  const pct = Math.min(100, (level / maxScale) * 100);
  const color = level <= 9 ? "#4ade80" : level <= 14 ? "#facc15" : "#f97316";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: appColors.textPrimary }}>
          Úroveň viscerálneho tuku
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>Low</span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>10</span>
        <span style={{ fontSize: 10, color: appColors.textMuted }}>High</span>
      </div>
    </div>
  );
}

/* ============================================================ */
/* INBODY SCORE BADGE */
/* ============================================================ */

function ScoreBadge({ score }: { score: number | null }) {
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
      <span style={{ fontSize: 12, fontWeight: 700, color: appColors.textMuted }}>
        InBody skóre
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color }}>
        {score}
        <span style={{ fontSize: 12, fontWeight: 500, color: appColors.textMuted }}>/100</span>
      </span>
    </div>
  );
}

/* ============================================================ */
/* PANÁČIK (segmentálna analýza) */
/* ============================================================ */

/**
 * Farba pre segmentálnu hodnotu podľa toho, či ide o SVALY (viac = dobré,
 * teda "Over" je zelené) alebo TUK (menej = dobré, "Under" je zelené).
 * "Normal"/akurát = biele/neutrálne, nie automaticky zelené.
 */
function segmentColor(evalLabel: string | null, kind: "lean" | "fat"): string {
  const l = (evalLabel || "").toLowerCase();
  if (l === "normal" || l === "") return appColors.textPrimary; // akurát = biele/neutrálne
  if (kind === "lean") {
    // Svaly: viac je dobré
    return l === "over" ? "#4ade80" : "#f97316"; // Over=zelené, Under=červené
  }
  // Tuk: menej je dobré
  return l === "under" ? "#4ade80" : "#f97316"; // Under=zelené, Over=červené
}

function BodyDiagram({
  segments,
  kind,
}: {
  segments: Record<string, SegmentalPart> | undefined;
  kind: "lean" | "fat";
}) {
  if (!segments) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <svg viewBox="0 0 200 220" width="220" height="240">
        {/* Panáčik: ruky vystreté do strán (~45°), nohy rovno dole, centrované */}
        {/* Hlava */}
        <circle cx="100" cy="24" r="14" fill={appColors.surfaceCardBorder} />
        {/* Trup */}
        <rect x="82" y="42" width="36" height="62" rx="10" fill={appColors.surfaceCardBorder} />
        {/* Ľavá ruka (vystretá diagonálne von) */}
        <rect
          x="44"
          y="48"
          width="15"
          height="58"
          rx="7"
          fill={appColors.surfaceCardBorder}
          transform="rotate(-35 51 77)"
        />
        {/* Pravá ruka */}
        <rect
          x="141"
          y="48"
          width="15"
          height="58"
          rx="7"
          fill={appColors.surfaceCardBorder}
          transform="rotate(35 148 77)"
        />
        {/* Nohy */}
        <rect x="83" y="106" width="15" height="90" rx="7" fill={appColors.surfaceCardBorder} />
        <rect x="102" y="106" width="15" height="90" rx="7" fill={appColors.surfaceCardBorder} />

        {/* Hodnoty - na okrajoch, mimo tela */}
        {segments.left_arm && (
          <text x="8" y="80" fontSize="12" fontWeight={700} textAnchor="start" fill={segmentColor(segments.left_arm.eval, kind)}>
            {segments.left_arm.kg != null ? `${segments.left_arm.kg}kg` : "—"}
          </text>
        )}
        {segments.right_arm && (
          <text x="192" y="80" fontSize="12" fontWeight={700} textAnchor="end" fill={segmentColor(segments.right_arm.eval, kind)}>
            {segments.right_arm.kg != null ? `${segments.right_arm.kg}kg` : "—"}
          </text>
        )}
        {segments.trunk && (
          <text x="100" y="76" fontSize="12" fontWeight={700} textAnchor="middle" fill={segmentColor(segments.trunk.eval, kind)}>
            {segments.trunk.kg != null ? `${segments.trunk.kg}kg` : "—"}
          </text>
        )}
        {segments.left_leg && (
          <text x="60" y="155" fontSize="12" fontWeight={700} textAnchor="end" fill={segmentColor(segments.left_leg.eval, kind)}>
            {segments.left_leg.kg != null ? `${segments.left_leg.kg}kg` : "—"}
          </text>
        )}
        {segments.right_leg && (
          <text x="140" y="155" fontSize="12" fontWeight={700} textAnchor="start" fill={segmentColor(segments.right_leg.eval, kind)}>
            {segments.right_leg.kg != null ? `${segments.right_leg.kg}kg` : "—"}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* HLAVNÝ EXPORT ============================================== */
/* ============================================================ */

export default function BodyScanVisualization({ scan }: { scan: BodyScan }) {
  const segmental = scan.segmental_analysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <ScoreBadge score={scan.inbody_score} />

      {/* 1. Muscle-Fat Analysis */}
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
          Analýza svalov a tuku
        </div>
        <ScaleBar
          label="Váha"
          value={scan.weight_kg}
          normalMin={scan.weight_range_min}
          normalMax={scan.weight_range_max}
          unit=" kg"
        />
        <ScaleBar
          label="Kostrové svalstvo (SMM)"
          value={scan.skeletal_muscle_mass_kg}
          normalMin={scan.smm_range_min}
          normalMax={scan.smm_range_max}
          unit=" kg"
        />
        <ScaleBar
          label="Telesný tuk"
          value={scan.body_fat_mass_kg}
          normalMin={scan.body_fat_mass_range_min}
          normalMax={scan.body_fat_mass_range_max}
          unit=" kg"
        />
      </div>

      {/* 2. Obesity Analysis */}
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
          Analýza obezity
        </div>
        <ScaleBar label="BMI" value={scan.bmi} normalMin={18.5} normalMax={25} />
        <ScaleBar
          label="% telesného tuku (PBF)"
          value={scan.pbf_percent}
          normalMin={10}
          normalMax={20}
          unit="%"
        />
      </div>

      {/* 3. Visceral Fat Level */}
      <VisceralFatBar level={scan.visceral_fat_level} />

      {/* 4. Panáčik so segmentálnou analýzou */}
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
            Segmentálna analýza svalov
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
            Segmentálna analýza tuku
          </div>
          <BodyDiagram segments={segmental.fat} kind="fat" />
        </div>
      )}
    </div>
  );
}