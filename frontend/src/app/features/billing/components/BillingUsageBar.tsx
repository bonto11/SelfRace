"use client";

import type {
   BillingUsageBarProps
} from "@/app/features/billing/types/billing";

export default function BillingUsageBar({
  limitTokens,
  usedTokens,
  resetAt,
}: BillingUsageBarProps) {
  const limit = Math.max(0, limitTokens ?? 0);
  const used = Math.max(0, usedTokens ?? 0);

  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  let barClass = "bg-emerald-500";
  if (pct >= 90) {
    barClass = "bg-red-500";
  } else if (pct >= 75) {
    barClass = "bg-amber-400";
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold">AI usage this month</span>
        {limit > 0 && (
          <span className="font-mono opacity-80">
            {used.toLocaleString("sk-SK")} /{" "}
            {limit.toLocaleString("sk-SK")} tokenov
          </span>
        )}
      </div>

      {limit > 0 ? (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${barClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] opacity-70">
            <span>Využitých ~{pct}% mesačného limitu.</span>
            {resetAt && (
              <span>Reset: {resetAt.slice(0, 10)}</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-[11px] opacity-70">
          Pre tento plán nemám definovaný AI limit.
        </div>
      )}
    </div>
  );
}