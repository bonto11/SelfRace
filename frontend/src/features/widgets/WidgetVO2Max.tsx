"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/shared/theme/tokens";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

type HistoryRow = { VO2Max: number | null; updated_at: string };
type EstRow = { value?: number | null; updated_at?: string | null; success?: boolean };
type Range = { label: string; min: number | null; max: number | null };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

function levelColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("excellent") || l.includes("elite")) return THEME.chart.excellent; // #10B981
  if (l.includes("superior")) return THEME.chart.superior;                         // #14B8A6
  if (l.includes("good")) return THEME.chart.good;                                 // #22D3EE
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;        // #F59E0B
  if (l.includes("poor")) return THEME.chart.poor;                                 // #F43F5E
  return THEME.chart.neutral;                                                      // #64748B
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("sk-SK") : "—";
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: `${color}1A`,   // ~10 % alpha
        border: `1px solid ${color}66`,
        color,
      }}
    >
      {label}
    </span>
  );
}

export default function WidgetVO2Max({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();

  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = React.useState<string>("");
  const [est, setEst] = React.useState<EstRow | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // merané
        const r1 = await fetch(`${API_URL}/profile/vo2-history/${userId}`, { cache: "no-store" });
        const js1 = await r1.json().catch(() => ({}));
        if (alive && js1?.success) {
          setHistory(Array.isArray(js1.history) ? js1.history : []);
          setSex(js1.sex === "F" ? "F" : "M");
          setBirthDate(js1.birth_date || "");
        } else if (alive) {
          setHistory([]);
        }

        // odhad
        const r2 = await fetch(`${API_URL}/profile/vo2-estimate/${userId}`, { cache: "no-store" });
        const js2: EstRow = await r2.json().catch(() => ({} as EstRow));
        if (alive) setEst(js2 ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const measured = history.length ? history[history.length - 1] : null;
  const mVO2 = measured?.VO2Max ?? null;

  // nájdi pásma podľa veku/pohlavia
  let ranges: Range[] = [];
  try {
    const age = birthDate
      ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 0;
    const g = (vo2Ref as Group[]).find((x) => x.sex === sex && age >= x.age_min && age <= x.age_max);
    ranges = g?.ranges ?? [];
  } catch {
    ranges = [];
  }

  // zistí level + farbu z rovnakého mapovania ako v trendoch
  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find((rr) => (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max));
    if (!hit) return null;
    const label = hit.label.trim();
    return { label, color: levelColor(label) };
  };

  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(Number.isFinite(est?.value as number) ? Number(est?.value) : null);

  // accent = farba levelu (uprednostni merané; ak nič, neutrál)
  const accentHex = levelMeasured?.color ?? levelEstimated?.color ?? THEME.chart.neutral;

  return (
    <WidgetCard
      title="VO₂Max"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accentHex}
      minH={168}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        // presne centrované: 1fr | 1px | 1fr, deliaca čiara v strede
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] items-start gap-6 md:gap-10">
          {/* ODHAD (ľavý blok) */}
          <div className="min-w-0">
            <div className="text-[11px] uppercase opacity-70">
              odhad: {fmtDate(est?.updated_at ?? null)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {Number.isFinite(est?.value as number) ? Number(est?.value).toFixed(1) : "—"}
              </div>
              {levelEstimated ? (
                <Pill label={levelEstimated.label} color={levelEstimated.color} />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>

          {/* separátor – presne v strede (len na md+) */}
          <div className="hidden md:block w-px bg-white/10 mx-auto" />

          {/* MERANÉ (pravý blok) */}
          <div className="min-w-0">
            <div className="text-[11px] uppercase opacity-70">
              merané: {fmtDate(measured?.updated_at)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {mVO2 != null ? mVO2.toFixed(1) : "—"}
              </div>
              {levelMeasured ? (
                <Pill label={levelMeasured.label} color={levelMeasured.color} />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}