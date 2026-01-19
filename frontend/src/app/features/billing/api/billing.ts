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

/* ---------- API helpers ---------- */

export async function apiListAppSubscriptionTiers(): Promise<
  AppSubscriptionTier[]
> {
  const path = `/app/subscription/tiers`;

  let json: ListTiersResponse;
  try {
    json = await callBackend<ListTiersResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Billing][apiListAppSubscriptionTiers] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (tiers): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load subscription tiers"
    );
  }

  return json.items ?? [];
}

export async function apiGetAppSubscriptionStatus(
  userId: number
): Promise<AppSubscriptionStatus | null> {
  if (!userId) throw new Error("Missing userId in apiGetAppSubscriptionStatus");

  const path = `/app/subscription/status/${encodeURIComponent(String(userId))}`;

  let json: StatusResponse;
  try {
    json = await callBackend<StatusResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionStatus] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (status): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load subscription status"
    );
  }

  return json.status ?? null;
}

export async function apiGetAppSubscriptionHistory(
  userId: number,
  limit = 20
): Promise<AppUserSubscription[]> {
  if (!userId)
    throw new Error("Missing userId in apiGetAppSubscriptionHistory");

  const path = `/app/subscription/history/${encodeURIComponent(
    String(userId)
  )}?limit=${encodeURIComponent(String(limit))}`;

  let json: HistoryResponse;
  try {
    json = await callBackend<HistoryResponse>(path, {
      method: "GET",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Billing][apiGetAppSubscriptionHistory] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (history): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load subscription history"
    );
  }

  return json.items ?? [];
}

/**
 * DEV helper – manuálne prepnutie tieru (bez reálnej platby).
 * - upgrade = hneď
 * - downgrade/free = plán od ďalšieho obdobia
 */
export async function apiSetAppSubscriptionTierManual(
  userId: number,
  tierCode: string
): Promise<SetTierResponse> {
  if (!userId) throw new Error("Missing userId in apiSetAppSubscriptionTier");
  if (!tierCode)
    throw new Error("Missing tierCode in apiSetAppSubscriptionTier");

  const path = `/app/subscription/set-tier/${encodeURIComponent(
    String(userId)
  )}`;

  let json: SetTierResponse;
  try {
    json = await callBackend<SetTierResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier_code: tierCode }),
    });
  } catch (err: any) {
    console.error("[Billing][apiSetAppSubscriptionTierManual] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (set-tier): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to set subscription tier"
    );
  }

  return json;
}

export async function apiCancelPlannedSubscriptionChange(
  userId: number
): Promise<CancelPlannedResponse> {
  if (!userId) {
    throw new Error("Missing userId in apiCancelPlannedSubscriptionChange");
  }

  const path = `/app/subscription/cancel-scheduled/${encodeURIComponent(
    String(userId)
  )}`;

  let json: CancelPlannedResponse;
  try {
    json = await callBackend<CancelPlannedResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Billing][apiCancelPlannedSubscriptionChange] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (cancel-scheduled): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to cancel scheduled change"
    );
  }

  return json;
}
