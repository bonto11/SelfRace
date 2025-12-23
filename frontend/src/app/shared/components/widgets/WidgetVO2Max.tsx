"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import Pill from "@/app/shared/components/ui/Pill";
import { API_URL } from "@/app/shared/config";
import { useUserId } from "@/app/shared/hooks/useUserId";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/app/shared/theme/tokens";
import { NO_X_OVERFLOW } from "@/app/shared/ui/classes";
import { fmtDate } from "@/app/shared/utils/time";
import {
  HistoryRow,
  EstRow,
  Group,
  Range,
} from "@/app/features/profile/types/profile";
import { levelColor } from "@/app/features/profile/utils/profile";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

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
        const r1 = await fetch(`${API_URL}/profile/vo2-history/${userId}`, {
          cache: "no-store",
        });
        const js1 = await r1.json().catch(() => ({}));
        if (alive && js1?.success) {
          setHistory(Array.isArray(js1.history) ? js1.history : []);
          setSex(js1.sex === "F" ? "F" : "M");
          setBirthDate(js1.birth_date || "");
        } else if (alive) {
          setHistory([]);
        }

        // odhad
        const r2 = await fetch(`${API_URL}/profile/vo2-estimate/${userId}`, {
          cache: "no-store",
        });
        const js2: EstRow = await r2.json().catch(() => ({} as EstRow));
        if (alive) setEst(js2 ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const measured = history.length ? history[history.length - 1] : null;
  const mVO2 = measured?.VO2Max ?? null;

  // nájdi pásma podľa veku/pohlavia
  let ranges: Range[] = [];
  try {
    const age = birthDate
      ? Math.floor(
          (Date.now() - new Date(birthDate).getTime()) /
            (365.25 * 24 * 3600 * 1000)
        )
      : 0;
    const g = (vo2Ref as Group[]).find(
      (x) => x.sex === sex && age >= x.age_min && age <= x.age_max
    );
    ranges = g?.ranges ?? [];
  } catch {
    ranges = [];
  }

  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find(
      (rr) => (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max)
    );
    if (!hit) return null;
    const label = hit.label.trim();
    return { label, color: levelColor(label) };
  };

  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(
    Number.isFinite(est?.value as number) ? Number(est?.value) : null
  );

  const accentHex =
    levelMeasured?.color ??
    levelEstimated?.color ??
    (THEME as any)?.accent?.primary ??
    (THEME as any)?.chart?.neutral ??
    "#64748B";

  return (
    <WidgetCard
      title="VO₂Max"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accentHex}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] items-start gap-6 md:gap-10">
          {/* ODHAD (ľavý blok) */}
          <div className="min-w-0">
            <div className="text-[11px] uppercase opacity-70">
              odhad: {fmtDate(est?.updated_at ?? null)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {Number.isFinite(est?.value as number)
                  ? Number(est?.value).toFixed(1)
                  : "—"}
              </div>
              {levelEstimated ? (
                <Pill
                  label={levelEstimated.label}
                  color={levelEstimated.color}
                />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>

          {/* separátor – md+ */}
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
