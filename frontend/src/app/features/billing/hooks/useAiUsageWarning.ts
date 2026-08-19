"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetAppSubscriptionStatus } from "@/app/features/billing/api/billing";
import { subscribeSubscriptionTier, getSubscriptionTier } from "@/app/shared/state/subscriptionTierStore";
import type { AppSubscriptionAiQuota } from "@/app/features/billing/types/billing";

const LOW_TOKENS_THRESHOLD = 10_000;
const VIP_INPUT_LIMIT = 10_000_000;
const VIP_OUTPUT_LIMIT = 2_000_000;

export function isLowOnQuota(aiQuota: AppSubscriptionAiQuota | null | undefined): boolean {
  if (!aiQuota?.limits || !aiQuota.remaining) return false;

  const { limits, remaining, is_over } = aiQuota;
  if (is_over) return true;

  const isVipInput = (limits.input ?? 0) > VIP_INPUT_LIMIT;
  const isVipOutput = (limits.output ?? 0) > VIP_OUTPUT_LIMIT;

  const inputLow = !isVipInput && (remaining.input ?? 0) < LOW_TOKENS_THRESHOLD;
  const outputLow = !isVipOutput && (remaining.output ?? 0) < LOW_TOKENS_THRESHOLD;

  return inputLow || outputLow;
}

/**
 * Zdieľaný stav pre "dochádzajú/došli AI kredity" naprieč appkou.
 * Používa header badge aj inline bannery pri AI featurách.
 */
export function useAiUsageWarning() {
  const { userId } = useUserId();
  const [tier, setTier] = useState(() => getSubscriptionTier() || "free");
  const [lowUsage, setLowUsage] = useState(false);

  useEffect(() => subscribeSubscriptionTier((next) => setTier(next || "free")), []);

  useEffect(() => {
    if (!userId || userId === 0) return;
    let alive = true;

    (async () => {
      try {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (!alive) return;
        setLowUsage(isLowOnQuota(st?.ai_quota));
      } catch {
        if (alive) setLowUsage(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const isFree = tier === "free";
  const showWarning = isFree || lowUsage;

  return { isFree, lowUsage, showWarning };
}