"use client";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachAIAnalyze({ onOpenDetail }: Props) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI analýza atleta
          </div>
          <div className="text-base font-semibold text-slate-50">
            Stav & fatigue overview
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
          AI
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Posledná analýza</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Fatigue</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Injury risk</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Tu bude krátke zhrnutie AI analýzy (fitnes, únava, riziká). Zatiaľ je
        widget len statický placeholder.
      </p>

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť detail analýzy
        </button>
      )}
    </div>
  );
}