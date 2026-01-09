"use client";

type BillingUsageBarProps = {
  limitTokens?: number | null;
  usedTokens?: number | null;
  resetAt?: string | null;
};

export default function BillingUsageBar({
  limitTokens,
  usedTokens,
  resetAt,
}: BillingUsageBarProps) {
  const used = Math.max(0, usedTokens ?? 0);
  const limit = limitTokens && limitTokens > 0 ? limitTokens : null;

  // ak nemáme žiadne dáta, nič nezobrazuj
  if (!limit && used === 0) {
    return null;
  }

  const pct = limit ? Math.min(100, (used / limit) * 100) : 100;

  return (
    <div className="mt-3 text-xs">
      <div className="flex items-center justify-between text-[11px] opacity-75">
        <span>AI usage tento mesiac</span>
        <span className="font-mono">
          {used.toLocaleString("sk-SK")}{" "}
          {limit
            ? ` / ${limit.toLocaleString("sk-SK")} tokenov`
            : " tokenov"}
        </span>
      </div>

      <div className="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full ${
            limit && used >= limit ? "bg-rose-400" : "bg-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] opacity-60">
        {limit && used >= limit ? (
          <span>Limit pre tento mesiac je vyčerpaný.</span>
        ) : limit ? (
          <span>
            Ostáva{" "}
            {(limit - used).toLocaleString("sk-SK")}
            {" tokenov"}
          </span>
        ) : (
          <span>Bez pevného limitu (interné logovanie).</span>
        )}
        {resetAt && (
          <span>Reset: {resetAt.slice(0, 10)}</span>
        )}
      </div>
    </div>
  );
}