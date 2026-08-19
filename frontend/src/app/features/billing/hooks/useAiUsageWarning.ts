"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetAppSubscriptionStatus } from "@/app/features/billing/api/billing";
import { subscribeSubscriptionTier, getSubscriptionTier } from "@/app/shared/state/subscriptionTierStore";
import type { AppSubscriptionAiQuota } from "@/app/features/billing/types/billing";

const LOW_TOKENS_THRESHOLD = 10_000;
const VIP_INPUT_LIMIT = 10_000_000;
const VIP_OUTPUT_LIMIT = 2_000_000;
const REFRESH_INTERVAL_MS = 60_000;

export function isLowOnQuota(aiQuota: AppSubscriptionAiQuota | null | undefined): boolean {
  if (!aiQuota?.limits) return false;

  if (aiQuota.is_over === true) return true;

  const { limits, usage } = aiQuota;

  const isVipInput = (limits.input ?? 0) > VIP_INPUT_LIMIT;
  const isVipOutput = (limits.output ?? 0) > VIP_OUTPUT_LIMIT;

  const remainingInput =
    aiQuota.remaining?.input ?? (limits.input ?? 0) - (usage?.input ?? 0);
  const remainingOutput =
    aiQuota.remaining?.output ?? (limits.output ?? 0) - (usage?.output ?? 0);

  const inputLow = !isVipInput && remainingInput < LOW_TOKENS_THRESHOLD;
  const outputLow = !isVipOutput && remainingOutput < LOW_TOKENS_THRESHOLD;

  return inputLow || outputLow;
}

/**
 * Zdieľaný stav pre "dochádzajú/došli AI kredity" naprieč appkou.
 * Refetchuje pri zmene userId AJ pri zmene cesty (pathname) — appka má
 * zdieľaný protected shell, ktorý sa pri navigácii medzi stránkami
 * nezmountuje odznova, takže bez tohto by badge/banner zamrzol na
 * hodnote z prvého načítania po prihlásení.
 */
export function useAiUsageWarning() {
  const { userId } = useUserId();
  const pathname = usePathname();
  const [tier, setTier] = useState(() => getSubscriptionTier() || "free");
  const [lowUsage, setLowUsage] = useState(false);

  useEffect(() => subscribeSubscriptionTier((next) => setTier(next || "free")), []);

  useEffect(() => {
    if (!userId || userId === 0) return;
    let alive = true;

    const fetchStatus = async () => {
      try {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (!alive) return;
        setLowUsage(isLowOnQuota(st?.ai_quota));
      } catch {
        if (alive) setLowUsage(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [userId, pathname]);

  const isFree = tier === "free";
  const showWarning = isFree || lowUsage;

  return { isFree, lowUsage, showWarning };
}