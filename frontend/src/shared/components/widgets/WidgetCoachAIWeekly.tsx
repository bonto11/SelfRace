"use client";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachAIWeekly({ onOpenDetail }: Props) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI weekly plán
          </div>
          <div className="text-base font-semibold text-slate-50">
            Týždenný rozpis tréningov
          </div>
        </div>
        <span className="rounded-full border border-sky-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-sky-200">
          PLAN
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-slate-300">
        <span>Týždne v pláne</span>
        <span className="text-right font-semibold text-slate-50">—</span>

        <span>Odhad minút / týždeň</span>
        <span className="text-right font-semibold text-slate-50">—</span>

        <span>Fáza zaťaženia</span>
        <span className="text-right font-semibold text-slate-50">—</span>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Tu neskôr zobrazíme high-level info z AI weekly plánu (počty týždňov,
        objem, fázu & fokus). Zatiaľ statický placeholder.
      </p>

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť weekly plán
        </button>
      )}
    </div>
  );
}