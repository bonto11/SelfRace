// src/app/features/account/api/account.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { AccountDeleteStatus } from "@/app/features/settings/types/account";

function inferStatus(json: any): AccountDeleteStatus["status"] {
  // preferuj explicitný status z BE (keď už bude)
  if (typeof json?.status === "string") return json.status;

  // fallback logika pre dnešný BE
  if (json?.hard_deleted_at) return "deleted";
  if (json?.cancelled_at) return "cancelled";
  if (!!json?.pending || !!json?.delete_at) return "pending";
  return "none";
}

function normalizeStatus(json: any, userId: number): AccountDeleteStatus {
  const status = inferStatus(json);

  return {
    user_id: typeof json?.user_id === "number" ? json.user_id : userId,

    // FE typ vyžaduje
    status,

    pending: !!json?.pending || status === "pending",
    requested_at:
      typeof json?.requested_at === "string" ? json.requested_at : null,
    delete_at: typeof json?.delete_at === "string" ? json.delete_at : null,
    cancelled_at:
      typeof json?.cancelled_at === "string" ? json.cancelled_at : null,
    hard_deleted_at:
      typeof json?.hard_deleted_at === "string" ? json.hard_deleted_at : null,
  };
}

export async function apiGetAccountDeleteStatus(
  userId: number,
): Promise<AccountDeleteStatus> {
  const path = `/account/delete/status/${userId}`;
  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return normalizeStatus(json, userId);
  } catch (err) {
    throw new Error("api.account.statusFailed");
  }
}

export async function apiRequestAccountDelete(
  userId: number,
): Promise<AccountDeleteStatus> {
  const path = `/account/delete/request/${userId}`;
  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
    });
    return normalizeStatus(json, userId);
  } catch (err) {
    throw new Error("api.account.requestFailed");
  }
}

export async function apiCancelAccountDelete(
  userId: number,
): Promise<AccountDeleteStatus> {
  const path = `/account/delete/cancel/${userId}`;
  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
    });
    return normalizeStatus(json, userId);
  } catch (err) {
    throw new Error("api.account.cancelFailed");
  }
}
