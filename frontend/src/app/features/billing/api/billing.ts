// src/app/features/billing/api/billing.ts

import { callBackend } from "@/app/shared/utils/callBackend";

import type {
  CancelPlannedResponse,
  AppSubscriptionTier,
  HistoryResponse,
  ListTiersResponse,
  AppUserSubscription,
  StatusResponse,
  SetTierResponse,
  // Naimportujeme tvoj originálny typ a dáme mu alias
  AppSubscriptionStatus as BaseAppSubscriptionStatus,
} from "@/app/features/billing/types/billing";

export type TokenMetrics = {
  input: number;
  output: number;
  total?: number;
};

export type AiQuotaStatus = {
  limits: TokenMetrics;
  usage: TokenMetrics;
  remaining: TokenMetrics;
  is_over: boolean;
  reset_at: string | null;
};

// Vytvoríme finálny typ tak, že zlúčime tvoj originál (s user_id atď.) a naše ai_quota
export type AppSubscriptionStatus = BaseAppSubscriptionStatus & {
  ai_quota?: AiQuotaStatus;
};

/* ---------- STRIPE API helpers ---------- */

export async function apiCreateStripeCheckout(
  userId: number,
  tier: string,
): Promise<string> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!tier) throw new Error("api.billing.missingTier");

  const path = `/billingStripe/create-checkout-session/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<{
      ok: boolean;
      checkout_url: string;
      detail?: string;
    }>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier }),
    });

    if (!json?.ok || !json?.checkout_url) {
      throw new Error("api.billing.checkoutSessionFailed");
    }

    return json.checkout_url;
  } catch (err: any) {
    console.error("[Billing][apiCreateStripeCheckout] ERROR", err);
    throw new Error("api.billing.checkoutSessionFailed");
  }
}

export async function apiCreateStripePortal(userId: number): Promise<string> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/billingStripe/create-portal-session/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<{
      ok: boolean;
      portal_url: string;
      detail?: string;
    }>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.ok || !json?.portal_url) {
      throw new Error("api.billing.portalSessionFailed");
    }

    return json.portal_url;
  } catch (err: any) {
    console.error("[Billing][apiCreateStripePortal] ERROR", err);
    throw new Error("api.billing.portalSessionFailed");
  }
}

/* ---------- APP BILLING API helpers ---------- */

export async function apiListAppSubscriptionTiers(): Promise<AppSubscriptionTier[]> {
  const path = `/app/subscription/tiers`;

  try {
    const json = await callBackend<ListTiersResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("api.common.fetchFailed");
    }

    return json.items ?? [];
  } catch (err: any) {
    console.error("[Billing][apiListAppSubscriptionTiers] ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

export async function apiGetAppSubscriptionStatus(
  userId: number,
): Promise<AppSubscriptionStatus | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/app/subscription/status/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<StatusResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("api.common.fetchFailed");
    }

    return (json.status as AppSubscriptionStatus) ?? null;
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionStatus] ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

export async function apiGetAppSubscriptionHistory(
  userId: number,
  limit = 20,
): Promise<AppUserSubscription[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/app/subscription/history/${encodeURIComponent(String(userId))}?limit=${encodeURIComponent(String(limit))}`;

  try {
    const json = await callBackend<HistoryResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("api.common.fetchFailed");
    }

    return json.items ?? [];
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionHistory] ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

export async function apiSetAppSubscriptionTierManual(
  userId: number,
  tierCode: string,
): Promise<SetTierResponse> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!tierCode) throw new Error("api.billing.missingTier");

  const path = `/app/subscription/set-tier/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<SetTierResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier_code: tierCode }),
    });

    if (!json?.success) {
      throw new Error("api.billing.tierChangeFailed");
    }

    return json;
  } catch (err: any) {
    console.error("[Billing][apiSetAppSubscriptionTierManual] ERROR", err);
    throw new Error("api.billing.tierChangeFailed");
  }
}

export async function apiCancelPlannedSubscriptionChange(
  userId: number,
): Promise<CancelPlannedResponse> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/app/subscription/cancel-scheduled/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<CancelPlannedResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("api.billing.cancelPlannedFailed");
    }

    return json;
  } catch (err: any) {
    console.error("[Billing][apiCancelPlannedSubscriptionChange] ERROR", err);
    throw new Error("api.billing.cancelPlannedFailed");
  }
}
