// src/app/features/billing/api/billing.ts

import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  CancelPlannedResponse,
  AppSubscriptionTier,
  HistoryResponse,
  ListTiersResponse,
  AppSubscriptionStatus,
  AppUserSubscription,
  StatusResponse,
  SetTierResponse,
} from "@/app/features/billing/types/billing";

/* ---------- STRIPE API helpers ---------- */
// ✅ Doplnený parameter userId
export async function apiCreateStripeCheckout(
  userId: number,
  tier: string,
): Promise<string> {
  if (!userId) throw new Error("common.errors.missingUserAuth");
  if (!tier) throw new Error("billing.errors.missingTier");

  // Vkladáme userId do URL!
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
      throw new Error("billing.errors.checkoutSessionFailed");
    }

    return json.checkout_url;
  } catch (err: any) {
    console.error("[Billing][apiCreateStripeCheckout] ERROR", err);
    throw new Error("billing.errors.checkoutSessionFailed");
  }
}

// ✅ Doplnený parameter userId
export async function apiCreateStripePortal(userId: number): Promise<string> {
  if (!userId) throw new Error("common.errors.missingUserAuth");

  // Vkladáme userId do URL!
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
      throw new Error("billing.errors.portalSessionFailed");
    }

    return json.portal_url;
  } catch (err: any) {
    console.error("[Billing][apiCreateStripePortal] ERROR", err);
    throw new Error("billing.errors.portalSessionFailed");
  }
}
/* ---------- APP BILLING API helpers ---------- */

export async function apiListAppSubscriptionTiers(): Promise<
  AppSubscriptionTier[]
> {
  const path = `/app/subscription/tiers`;

  try {
    const json = await callBackend<ListTiersResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("billing.errors.fetchTiersFailed");
    }

    return json.items ?? [];
  } catch (err: any) {
    console.error("[Billing][apiListAppSubscriptionTiers] ERROR", err);
    throw new Error("billing.errors.fetchTiersFailed");
  }
}

export async function apiGetAppSubscriptionStatus(
  userId: number,
): Promise<AppSubscriptionStatus | null> {
  if (!userId) throw new Error("common.errors.missingUser");

  const path = `/app/subscription/status/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<StatusResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("billing.errors.loadStatusFailed");
    }

    return json.status ?? null;
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionStatus] ERROR", err);
    throw new Error("billing.errors.loadStatusFailed");
  }
}

export async function apiGetAppSubscriptionHistory(
  userId: number,
  limit = 20,
): Promise<AppUserSubscription[]> {
  if (!userId) throw new Error("common.errors.missingUser");

  const path = `/app/subscription/history/${encodeURIComponent(String(userId))}?limit=${encodeURIComponent(String(limit))}`;

  try {
    const json = await callBackend<HistoryResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("billing.errors.loadHistoryFailed");
    }

    return json.items ?? [];
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionHistory] ERROR", err);
    throw new Error("billing.errors.loadHistoryFailed");
  }
}

/**
 * DEV helper – manuálne prepnutie tieru (bez reálnej platby).
 * Už sa v produkcii pravdepodobne nahradí Stripe Checkoutom.
 */
export async function apiSetAppSubscriptionTierManual(
  userId: number,
  tierCode: string,
): Promise<SetTierResponse> {
  if (!userId) throw new Error("common.errors.missingUser");
  if (!tierCode) throw new Error("billing.errors.missingTier");

  const path = `/app/subscription/set-tier/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<SetTierResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier_code: tierCode }),
    });

    if (!json?.success) {
      throw new Error("billing.errors.tierChangeFailed");
    }

    return json;
  } catch (err: any) {
    console.error("[Billing][apiSetAppSubscriptionTierManual] ERROR", err);
    throw new Error("billing.errors.tierChangeFailed");
  }
}

/**
 * DEV helper - zrušenie zmeny.
 * V produkcii sa bude riešiť cez Stripe Portal.
 */
export async function apiCancelPlannedSubscriptionChange(
  userId: number,
): Promise<CancelPlannedResponse> {
  if (!userId) throw new Error("common.errors.missingUser");

  const path = `/app/subscription/cancel-scheduled/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<CancelPlannedResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });

    if (!json?.success) {
      throw new Error("billing.errors.cancelPlannedFailed");
    }

    return json;
  } catch (err: any) {
    console.error("[Billing][apiCancelPlannedSubscriptionChange] ERROR", err);
    throw new Error("billing.errors.cancelPlannedFailed");
  }
}
