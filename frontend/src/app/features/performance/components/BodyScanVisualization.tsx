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

  // Škála zobrazuje rozsah 0 -> normalMax * 1.6 (dosť miesta pre "Over" pásmo),
  // normalMin/normalMax definujú "Normal" zelenú zónu uprostred.
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
        {/* Normal zóna (zelená) */}
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
        {/* Ukazovateľ aktuálnej hodnoty */}
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
          {normalMin}–{normalMax} ({label === "BMI" || label.includes("%") ? "Normal" : "priemer"})
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
          background: "linear-gradient(to right, #4ade8033 0%, #4ade8033 50%, #f9731633 50%, #f9731633 100%)",
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
/* PANÁČIK (segmentálna analýza) */
/* ============================================================ */

function BodyDiagram({
  segments,
  colorFn,
}: {
  segments: Record<string, SegmentalPart> | undefined;
  colorFn: (evalLabel: string | null) => string;
}) {
  if (!segments) return null;

  const parts: { key: string; x: number; y: number; anchor: "start" | "end" }[] = [
    { key: "left_arm", x: 18, y: 90, anchor: "end" },
    { key: "right_arm", x: 82, y: 90, anchor: "start" },
    { key: "trunk", x: 50, y: 95, anchor: "start" },
    { key: "left_leg", x: 30, y: 220, anchor: "end" },
    { key: "right_leg", x: 70, y: 220, anchor: "start" },
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <svg viewBox="0 0 100 260" width="180" height="260">
        {/* Jednoduchý panáčik - hlava, trup, ruky, nohy */}
        <circle cx="50" cy="20" r="12" fill={appColors.surfaceCardBorder} />
        <rect x="38" y="34" width="24" height="60" rx="8" fill={appColors.surfaceCardBorder} />
        <rect x="20" y="38" width="14" height="55" rx="6" fill={appColors.surfaceCardBorder} />
        <rect x="66" y="38" width="14" height="55" rx="6" fill={appColors.surfaceCardBorder} />
        <rect x="38" y="96" width="11" height="80" rx="6" fill={appColors.surfaceCardBorder} />
        <rect x="51" y="96" width="11" height="80" rx="6" fill={appColors.surfaceCardBorder} />

        {parts.map((p) => {
          const seg = segments[p.key];
          if (!seg) return null;
          return (
            <text
              key={p.key}
              x={p.x}
              y={p.y}
              fontSize="7"
              fill={colorFn(seg.eval)}
              textAnchor={p.anchor}
              fontWeight={700}
            >
              {seg.kg != null ? `${seg.kg}kg` : "—"}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ */
/* HLAVNÝ EXPORT ============================================== */
/* ============================================================ */

export default function BodyScanVisualization({ scan }: { scan: BodyScan }) {
  const segmental = scan.segmental_analysis;

  const evalColor = (evalLabel: string | null) => {
    const l = (evalLabel || "").toLowerCase();
    if (l === "over") return "#f97316";
    if (l === "under") return "#facc15";
    return "#4ade80";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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

      {/* 2. Obesity Analysis (spoľahlivé univerzálne rozsahy) */}
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
          <BodyDiagram segments={segmental.lean} colorFn={evalColor} />

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
          <BodyDiagram segments={segmental.fat} colorFn={evalColor} />
        </div>
      )}
    </div>
  );
}