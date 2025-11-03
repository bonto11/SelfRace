"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import Button from "@/shared/components/ui/Button";
import { Plus, Minus } from "lucide-react";
import { toast } from "@/shared/components/ui/Toast";

type LatestMap = {
  value: number | null;
  unit?: string | null;
  updated_at?: string | null;
} | null;

type LatestResp = {
  success: boolean;
  data: {
    weight_kg?: LatestMap;
    body_fat_pct?: LatestMap;
    HR_max?: LatestMap;
    VO2Max_measured?: LatestMap;
    VO2Max_estimated?: LatestMap;
    BMI?: LatestMap;
  };
};

type MetricState = {
  weight_kg: number | null;
  body_fat_pct: number | null;
  HR_max: number | null;
  VO2Max_measured: number | null;
  VO2Max_estimated: number | null;
};

const NUM_INPUT = "w-full px-3 py-2 rounded border border-neutral-800 bg-[#111827] text-[#E5E7EB] text-center";

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("sk-SK") : "—";
}

function SummaryRow({ k, v, extra }: { k: string; v: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="opacity-70 text-sm">{k}</span>
      <span className="text-sm font-medium">
        {v} {extra ? <span className="opacity-60 ml-1">({extra})</span> : null}
      </span>
    </div>
  );
}

export default function TableMetrics() {
  const { userId } = useUserId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [latest, setLatest] = useState<LatestResp["data"] | null>(null);
  const [m, setM] = useState<MetricState>({
    weight_kg: null,
    body_fat_pct: null,
    HR_max: null,
    VO2Max_measured: null,
    VO2Max_estimated: null,
  });

  // načítaj posledné hodnoty + predvyplň
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/profile/metrics/latest/${userId}`, { cache: "no-store" });
        const js: LatestResp = await r.json().catch(() => ({ success: false, data: {} as any }));
        if (!alive) return;
        if (js?.success) {
          setLatest(js.data);
          setM({
            weight_kg: js.data.weight_kg?.value ?? null,
            body_fat_pct: js.data.body_fat_pct?.value ?? null,
            HR_max: js.data.HR_max?.value ?? null,
            VO2Max_measured: js.data.VO2Max_measured?.value ?? null,
            VO2Max_estimated: js.data.VO2Max_estimated?.value ?? null,
          });
        } else {
          setLatest(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const bmiText = useMemo(() => {
    const bmi = latest?.BMI?.value;
    return Number.isFinite(bmi as number) ? (bmi as number).toFixed(1) : "—";
  }, [latest]);

  async function handleSave() {
    if (!userId) return;
    try {
      const entries = [
        ["weight_kg", m.weight_kg, "kg"],
        ["body_fat_pct", m.body_fat_pct, "%"],
        ["HR_max", m.HR_max, "bpm"],
        ["VO2Max_measured", m.VO2Max_measured, "mL/kg/min"],
        ["VO2Max_estimated", m.VO2Max_estimated, "mL/kg/min"],
      ] as const;

      const payload = {
        entries: entries
          .filter(([, val]) => Number.isFinite(val as number))
          .map(([metric, value, unit]) => ({
            metric,
            value_num: Number(value),
            unit,
            measured_at: new Date().toISOString(),
            source: "user",
          })),
      };

      if (!payload.entries.length) {
        toast.error("Zadaj aspoň jednu hodnotu.");
        return;
      }

      setLoading(true);
      const res = await fetch(`${API_URL}/profile/metrics/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const js = await res.json();
      if (js?.success) {
        toast.success(`✅ Uložené (${js.inserted})`);
        // refresh latest
        const r2 = await fetch(`${API_URL}/profile/metrics/latest/${userId}`, { cache: "no-store" });
        const l2: LatestResp = await r2.json();
        if (l2?.success) setLatest(l2.data);
        setOpen(false);
      } else {
        toast.error(`❌ Chyba: ${js?.detail || "unknown"}`);
      }
    } catch (e: any) {
      toast.error(`❌ Request failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/90 dark:bg-gray-900/70 backdrop-blur p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-semibold">Metrics</h2>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition"
          aria-label={open ? "Zbaliť" : "Rozbaliť"}
          title={open ? "Zbaliť" : "Rozbaliť"}
        >
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {!open ? (
        <div className="mt-2">
          <SummaryRow
            k="Weight"
            v={Number.isFinite(latest?.weight_kg?.value as number) ? `${latest?.weight_kg?.value} kg` : "—"}
            extra={fmtDate(latest?.weight_kg?.updated_at)}
          />
          <SummaryRow
            k="Body fat %"
            v={Number.isFinite(latest?.body_fat_pct?.value as number) ? `${latest?.body_fat_pct?.value}%` : "—"}
            extra={fmtDate(latest?.body_fat_pct?.updated_at)}
          />
          <SummaryRow
            k="HR max"
            v={Number.isFinite(latest?.HR_max?.value as number) ? `${latest?.HR_max?.value} bpm` : "—"}
            extra={fmtDate(latest?.HR_max?.updated_at)}
          />
          <SummaryRow
            k="VO₂Max (measured)"
            v={Number.isFinite(latest?.VO2Max_measured?.value as number) ? `${latest?.VO2Max_measured?.value}` : "—"}
            extra={fmtDate(latest?.VO2Max_measured?.updated_at)}
          />
          <SummaryRow
            k="VO₂Max (estimated)"
            v={Number.isFinite(latest?.VO2Max_estimated?.value as number) ? `${latest?.VO2Max_estimated?.value}` : "—"}
            extra={fmtDate(latest?.VO2Max_estimated?.updated_at)}
          />
          <SummaryRow k="BMI" v={bmiText} extra={fmtDate(latest?.BMI?.updated_at)} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              value={m.weight_kg ?? ""}
              onChange={(e) => setM(s => ({ ...s, weight_kg: e.target.value ? Number(e.target.value) : null }))}
              className={NUM_INPUT}
            />
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">Body fat %</label>
            <input
              type="number"
              inputMode="decimal"
              value={m.body_fat_pct ?? ""}
              onChange={(e) => setM(s => ({ ...s, body_fat_pct: e.target.value ? Number(e.target.value) : null }))}
              className={NUM_INPUT}
            />
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">HR max (bpm)</label>
            <input
              type="number"
              inputMode="numeric"
              value={m.HR_max ?? ""}
              onChange={(e) => setM(s => ({ ...s, HR_max: e.target.value ? Number(e.target.value) : null }))}
              className={NUM_INPUT}
            />
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">VO₂Max (measured)</label>
            <input
              type="number"
              inputMode="decimal"
              value={m.VO2Max_measured ?? ""}
              onChange={(e) => setM(s => ({ ...s, VO2Max_measured: e.target.value ? Number(e.target.value) : null }))}
              className={NUM_INPUT}
            />
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">VO₂Max (estimated)</label>
            <input
              type="number"
              inputMode="decimal"
              value={m.VO2Max_estimated ?? ""}
              onChange={(e) => setM(s => ({ ...s, VO2Max_estimated: e.target.value ? Number(e.target.value) : null }))}
              className={NUM_INPUT}
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-1">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Ukladám…" : "Save new entry"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}