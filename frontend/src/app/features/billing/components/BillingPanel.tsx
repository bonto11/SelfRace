// src/features/billing/components/BillingPanel.tsx
"use client";

import { useEffect, useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { toast } from "@/app/shared/components/ui/Toast";

import {
  apiGetAppSubscriptionStatus,
  apiGetAppSubscriptionHistory,
  apiSetAppSubscriptionTierManual,
  apiCancelPlannedSubscriptionChange,
  type AppSubscriptionStatus,
  type AppSubscriptionTier,
  type AppUserSubscription,
} from "@/app/features/billing/api/app_subscription";

type LoadingKind = "status" | "history" | "set-tier" | null;

const TIER_ORDER: Record<string, number> = {
  free: 0,
  classic: 1,
  pro: 2,
};

function tierRank(code: string | null | undefined): number {
  if (!code) return 0;
  return TIER_ORDER[code] ?? 0;
}

export default function BillingPanel() {
  const { userId } = useUserId();
  const [status, setStatus] = useState<AppSubscriptionStatus | null>(null);
  const [history, setHistory] = useState<AppUserSubscription[]>([]);
  const [loading, setLoading] = useState<LoadingKind>("status");
  const [error, setError] = useState<string | null>(null);
  const [activeTierCode, setActiveTierCode] = useState<string>("free");

  const plannedChange = status?.scheduled_change ?? null;
  const activeSub = status?.active_subscription ?? null;

  // load status + tiers
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading("status");
      setError(null);
      try {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (!alive) return;
        if (st) {
          setStatus(st);
          setActiveTierCode(st.tier_code || "free");
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load subscription status.");
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // history
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading((prev) => prev || "history");
      try {
        const h = await apiGetAppSubscriptionHistory(userId, 20);
        if (!alive) return;
        setHistory(h);
      } catch {
        // optional
      } finally {
        if (!alive) return;
        setLoading(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const tiers: AppSubscriptionTier[] = status?.tiers ?? [];
  const activeRank = tierRank(activeTierCode);

  async function handleSetTier(tierCode: string) {
    if (!userId) {
      toast.error("Missing user id.");
      return;
    }
    if (!tierCode) return;

    setLoading("set-tier");
    setError(null);
    try {
      await apiSetAppSubscriptionTierManual(userId, tierCode);
      toast.success(`Tier switched to "${tierCode}".`);

      const st = await apiGetAppSubscriptionStatus(userId);
      setStatus(st);
      setActiveTierCode(st?.tier_code || tierCode);

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Failed to set subscription tier.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  async function handleCancelPlannedChange() {
    if (!userId) return;

    setLoading("set-tier");
    setError(null);
    try {
      await apiCancelPlannedSubscriptionChange(userId);
      toast.success("Plánovaná zmena zrušená. Zostáva aktuálny program.");

      const st = await apiGetAppSubscriptionStatus(userId);
      setStatus(st);
      setActiveTierCode(st?.tier_code || "free");

      const h = await apiGetAppSubscriptionHistory(userId, 20);
      setHistory(h);
    } catch (e: any) {
      const msg = e?.message || "Failed to cancel scheduled change.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  if (!userId) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm">
        Musíš byť prihlásený, aby si videl nastavenia účtu.
      </div>
    );
  }

  const hasPlannedChange =
    !!plannedChange &&
    !!activeSub &&
    !!activeSub.current_period_end &&
    activeSub.cancel_at_period_end;

  return (
    <div className="space-y-6">
      {/* Current status */}
      <section className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Subscription status</h2>
            <p className="text-xs opacity-70">
              Aktuálny mód aplikácie a AI limity.
            </p>
          </div>
          {loading === "status" && <LoadingSpinner size="button" />}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400 line-clamp-2">{error}</p>
        )}

        <div className="mt-3 text-sm space-y-1">
          <div>
            <span className="opacity-70">Current tier: </span>
            <span className="font-semibold uppercase">
              {activeTierCode || "free"}
            </span>
          </div>

          {activeSub ? (
            <>
              <div>
                <span className="opacity-70">Status: </span>
                <span className="font-semibold">
                  {activeSub.status}
                  {activeSub.cancel_at_period_end &&
                    " (cancel at period end)"}
                </span>
              </div>
              <div className="text-xs opacity-75">
                {activeSub.current_period_start &&
                  activeSub.current_period_end && (
                    <>
                      Billing period:{" "}
                      {activeSub.current_period_start.slice(0, 10)} →{" "}
                      {activeSub.current_period_end.slice(0, 10)}
                    </>
                  )}
              </div>

              {hasPlannedChange && (
                <div className="mt-2 text-xs">
                  <div className="text-amber-300">
                    {plannedChange.kind === "cancel"
                      ? "Planned cancellation"
                      : "Planned downgrade"}{" "}
                    {plannedChange.to_tier_code && (
                      <>
                        to{" "}
                        <span className="font-semibold uppercase">
                          {plannedChange.to_tier_code}
                        </span>
                      </>
                    )}{" "}
                    {plannedChange.effective_from && (
                      <>
                        from{" "}
                        <span className="font-mono">
                          {plannedChange.effective_from.slice(0, 10)}
                        </span>
                      </>
                    )}
                    .
                  </div>

                  <div className="mt-1">
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={loading === "set-tier"}
                      onClick={handleCancelPlannedChange}
                    >
                      {loading === "set-tier" ? (
                        <span className="inline-flex items-center gap-1">
                          <LoadingSpinner size="button" />
                          Keeping current…
                        </span>
                      ) : (
                        "Keep current program"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs opacity-75">
              Nemáš aktívne platené členstvo. Používaš free tier.
            </p>
          )}
        </div>
      </section>

      {/* Tiers list + manual switch */}
      <section className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Tiers</h2>
            <p className="text-xs opacity-70">
              DEV: upgrade hneď, downgrade alebo prechod na free od ďalšieho
              obdobia.
            </p>
          </div>
        </div>

        {tiers.length === 0 ? (
          <p className="mt-3 text-sm opacity-70">
            Zatiaľ nemáš v DB nakonfigurované žiadne subscription tiers.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {tiers.map((tier) => {
              const isCurrent = tier.code === activeTierCode;
              const priceEur = (tier.monthly_price_cents || 0) / 100;
              const rank = tierRank(tier.code);
              const isUpgrade = rank > activeRank;
              const isDowngrade = rank < activeRank;

              const isPlannedTarget =
                !!plannedChange &&
                plannedChange.to_tier_code === tier.code &&
                plannedChange.kind === "downgrade";

              let buttonLabel = "Switch to this tier";
              if (isCurrent) {
                buttonLabel = "Current tier";
              } else if (tier.code === "free" && plannedChange?.kind === "cancel") {
                buttonLabel = plannedChange.effective_from
                  ? `Cancel on ${plannedChange.effective_from.slice(0, 10)}`
                  : "Cancel scheduled";
              } else if (isPlannedTarget) {
                buttonLabel = plannedChange?.effective_from
                  ? `Downgrade on ${plannedChange.effective_from.slice(0, 10)}`
                  : "Downgrade scheduled";
              } else if (tier.code === "free") {
                buttonLabel = "Schedule cancel";
              } else if (isDowngrade) {
                buttonLabel = "Schedule downgrade";
              } else if (isUpgrade) {
                buttonLabel = "Upgrade now";
              }

              const disabled =
                loading === "set-tier" ||
                isCurrent ||
                isPlannedTarget ||
                (tier.code === "free" && plannedChange?.kind === "cancel");

              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border px-3 py-3 text-sm bg-black/40 ${
                    isCurrent
                      ? "border-emerald-400/70"
                      : isPlannedTarget ||
                        (tier.code === "free" && plannedChange?.kind === "cancel")
                      ? "border-amber-400/70"
                      : "border-white/10 opacity-90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold uppercase tracking-wide text-xs">
                        {tier.code}
                      </div>
                      <div className="text-xs opacity-70">{tier.name}</div>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] rounded-full border border-emerald-400/70 px-2 py-0.5 text-emerald-300">
                        current
                      </span>
                    )}
                    {!isCurrent &&
                      (isPlannedTarget ||
                        (tier.code === "free" &&
                          plannedChange?.kind === "cancel")) && (
                        <span className="text-[10px] rounded-full border border-amber-400/70 px-2 py-0.5 text-amber-300">
                          scheduled
                        </span>
                      )}
                  </div>

                  <div className="mt-2 text-sm">
                    {priceEur === 0 ? (
                      <span className="font-semibold">Free</span>
                    ) : (
                      <span className="font-semibold">
                        {priceEur.toFixed(2)} € / mesiac
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-[11px] opacity-70">
                    AI limit:{" "}
                    <span className="font-semibold">
                      {tier.ai_monthly_tokens_limit.toLocaleString("sk-SK")}{" "}
                      tokenov / mesiac
                    </span>
                  </div>

                  {tier.description && (
                    <p className="mt-1 text-[11px] opacity-80 line-clamp-3">
                      {tier.description}
                    </p>
                  )}

                  <div className="mt-3">
                    <Button
                      size="xs"
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={disabled}
                      onClick={() => handleSetTier(tier.code)}
                    >
                      {loading === "set-tier" && !isCurrent ? (
                        <span className="inline-flex items-center gap-1">
                          <LoadingSpinner size="button" />
                          Switching…
                        </span>
                      ) : (
                        buttonLabel
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History (optional info) */}
      <section className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">History</h2>
        </div>

        {history.length === 0 ? (
          <p className="mt-2 text-xs opacity-70">
            Zatiaľ žiadne záznamy o subscriptionoch.
          </p>
        ) : (
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
        )}
      </section>
    </div>
  );
}