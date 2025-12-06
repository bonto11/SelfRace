"use client";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachAIDaily({ onOpenDetail }: Props) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI daily plán
          </div>
          <div className="text-base font-semibold text-slate-50">
            Detailný rozpis týždňa
          </div>
        </div>
        <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-200">
          DAILY
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-300">
        <div className="flex justify-between">
          <span>Počet dní</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
        <div className="flex justify-between">
          <span>Počet hard tréningov</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
        <div className="flex justify-between">
          <span>Silové tréningy</span>
          <span className="font-semibold text-slate-50">—</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Sem pôjde krátke zhrnutie AI daily plánu (počty hard / strength dní,
        celkový čas). Zatiaľ len statický widget.
      </p>

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť daily plán
        </button>
      )}
    </div>
  );
}