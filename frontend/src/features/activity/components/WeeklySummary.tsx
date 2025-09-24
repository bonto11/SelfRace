// src/components/Activity/WeeklySummary.tsx
"use client";

type Metric = "km" | "time" | "trimp";

type WeekAgg = {
  week: string;
  start: string;
  end: string;
  km_total: number;
  time_min: number;
  trimp: number;
  monotony: { km: number; time: number; trimp: number };
  strain:   { km: number; time: number; trimp: number };
};

function mean(xs: number[]) {
  const vals = xs.filter((v) => Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function kpiColor(v: number, ranges: { ok: [number, number]; warn: [number, number] }) {
  if (v >= ranges.ok[0] && v <= ranges.ok[1]) return "text-green-400";
  if (v >= ranges.warn[0] && v <= ranges.warn[1]) return "text-amber-400";
  return "text-red-400";
}

export default function WeeklySummary({
  weeks,
  metric,
  selectedWeek,
}: {
  weeks: WeekAgg[];
  metric: Metric;
  selectedWeek?: string | null;
}) {
  if (!weeks?.length) return null;

  const idx = selectedWeek
    ? Math.max(0, weeks.findIndex((w) => w.week === selectedWeek))
    : weeks.length - 1;

  const last = weeks[idx];
  const prev4 = weeks.slice(Math.max(0, idx - 4), idx);

  const key = metric === "km" ? "km_total" : metric === "time" ? "time_min" : "trimp";
  const lastLoad = (last as any)[key] as number;
  const chronic = mean(prev4.map((w) => (w as any)[key] as number));
  const acwr = chronic > 0 ? lastLoad / chronic : 0;

  const mono = last.monotony[metric];
  const strn = last.strain[metric];

  // prahy (môžeš doladiť)
  const acwrColor = kpiColor(acwr, { ok: [0.8, 1.3], warn: [0.7, 1.5] });
  const monoColor = mono <= 0 ? "text-gray-400" : kpiColor(mono, { ok: [0.8, 1.5], warn: [1.5, 2.0] });

  // strain porovnáme s mediánom posledných 6 týždňov (tu jednoduchšie s priemerom)
  const hist = weeks.slice(Math.max(0, idx - 6), idx).map((w) => w.strain[metric]);
  const base = mean(hist);
  const strainRatio = base > 0 ? strn / base : 0;
  const strainColor = kpiColor(strainRatio, { ok: [0.8, 1.3], warn: [0.7, 1.6] });

  const unit = metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP";

  // krátke tipy
  const tips: string[] = [];
  if (acwr > 1.5) tips.push("Veľký skok záťaže vs. 4-týždňový priemer – zváž odľahčenie.");
  else if (acwr < 0.7) tips.push("Veľmi nízka záťaž – pozor na prepad formy.");
  if (mono > 2.0) tips.push("Monotónny týždeň – pridaj variabilitu (ľahký deň/regeneračný tréning).");
  if (strainRatio > 1.6) tips.push("Strain vysoko nad bežným – sleduj únavu, spi viac.");

  return (
    <div className="mt-3 border border-gray-700 rounded p-3 bg-gray-900 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">
          Week-in-Review {last.week} <span className="opacity-60">({last.start} – {last.end})</span>
        </div>
        <div className="opacity-70">Metrika: <b>{metric.toUpperCase()}</b></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded p-3">
          <div className="opacity-70">ACWR (last / avg-4w)</div>
          <div className={`text-2xl font-bold ${acwrColor}`}>{acwr.toFixed(2)}</div>
          <div className="opacity-70 text-xs mt-1">
            Tento týždeň: <b>{Math.round(lastLoad)} {unit}</b>, priemer 4w: <b>{Math.round(chronic)} {unit}</b>
          </div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="opacity-70">Monotony</div>
          <div className={`text-2xl font-bold ${monoColor}`}>{mono > 0 ? mono.toFixed(2) : "-"}</div>
          <div className="opacity-70 text-xs mt-1">~1 = vyrovnaný týždeň</div>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <div className="opacity-70">Strain vs. dlhodobý</div>
          <div className={`text-2xl font-bold ${strainColor}`}>{Number.isFinite(strainRatio) ? strainRatio.toFixed(2) : "-"}</div>
          <div className="opacity-70 text-xs mt-1">Záťaž / priemer posledných ~6 týždňov</div>
        </div>
      </div>

      {tips.length > 0 && (
        <div className="mt-3">
          <div className="font-semibold mb-1">Odporúčania</div>
          <ul className="list-disc pl-5 space-y-1">
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}