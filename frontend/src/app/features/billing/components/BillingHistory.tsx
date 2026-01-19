"use client";

import type { AppUserSubscription } from "@/app/features/billing/types/billing";

type BillingHistoryProps = {
  history: AppUserSubscription[];
};

export default function BillingHistory({ history }: BillingHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="mt-2 text-xs opacity-70">
        Zatiaľ žiadne záznamy o subscriptionoch.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 text-xs">
      {history.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2"
        >
          <div>
            <div className="font-semibold uppercase">
              {s.tier_code} • {s.status}
            </div>
            <div className="opacity-70">
              {s.current_period_start?.slice(0, 10)} →{" "}
              {s.current_period_end?.slice(0, 10)}
            </div>
          </div>
          <div className="opacity-60">{s.created_at.slice(0, 10)}</div>
        </div>
      ))}
    </div>
  );
}