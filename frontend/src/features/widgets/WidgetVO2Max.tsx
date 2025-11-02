"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";

type Props = {
  /** preferované – otvoriť detail trendu */
  onOpen?: () => void;
  /** spätná kompatibilita s tvojím volaním */
  onOpenDetail?: () => void;
};

type HistoryRow = { VO2Max: number | null; updated_at: string };
type Range = { label: string; min: number | null; max: number | null; color: string };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

export default function WidgetVO2Max({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(true);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = React.useState<string>("");

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/profile/vo2-history/${userId}`, { cache: "no-store" });
        const js = await res.json().catch(() => ({}));
        if (!alive) return;
        if (js?.success) {
          setHistory(Array.isArray(js.history) ? js.history : []);
          setSex(js.sex === "F" ? "F" : "M");
          setBirthDate(js.birth_date || "");
        } else {
          setHistory([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const latest = history.length ? history[history.length - 1] : null;
  const latestVO2 = latest?.VO2Max ?? null;

  // vyhodnotenie úrovne podľa veku/pohlavia
  let level: { label: string; color: string } | null = null;
  try {
    if (birthDate && latestVO2 != null) {
      const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
      const g = (vo2Ref as Group[]).find(
        (x) => x.sex === sex && age >= x.age_min && age <= x.age_max
      );
      const r = g?.ranges?.find(
        (rr) =>
          (rr.min == null || latestVO2 >= rr.min) &&
          (rr.max == null || latestVO2 <= rr.max)
      );
      if (r) level = { label: r.label.trim(), color: r.color };
    }
  } catch {}

  return (
    <WidgetCard
      title="VO₂Max"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="bg-cyan-400"
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-4xl font-extrabold tabular-nums">
              {latestVO2 != null ? latestVO2.toFixed(1) : "—"}
            </div>
            <div className="text-xs opacity-70">
              {latest?.updated_at
                ? new Date(latest.updated_at).toLocaleDateString("sk-SK")
                : "bez dátumu"}
            </div>
          </div>

          <div className="text-right">
            <div
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: level ? `${level.color}22` : "rgba(255,255,255,0.08)",
                border: level ? `1px solid ${level.color}66` : "1px solid rgba(255,255,255,0.12)",
                color: level ? level.color : "inherit",
              }}
              title={level?.label ?? "bez kategórie"}
            >
              {level?.label ?? "—"}
            </div>
            <div className="mt-1 text-[11px] opacity-60">naposledy merané</div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}