// src/app/features/account/api/accountDelete.ts
import { API_URL } from "@/app/shared/config";
import type { AccountDeleteStatus } from "@/app/features/account/types/account";

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
  return {
    user_id: typeof json?.user_id === "number" ? json.user_id : userId,

    // nové pole, FE ho chce
    status: inferStatus(json),

    // tieto polia FE typ vyžaduje
    pending: !!json?.pending || inferStatus(json) === "pending",
    requested_at: typeof json?.requested_at === "string" ? json.requested_at : null,
    delete_at: typeof json?.delete_at === "string" ? json.delete_at : null,
    cancelled_at: typeof json?.cancelled_at === "string" ? json.cancelled_at : null,
    hard_deleted_at: typeof json?.hard_deleted_at === "string" ? json.hard_deleted_at : null,
  };
}

export async function apiGetAccountDeleteStatus(userId: number): Promise<AccountDeleteStatus> {
  const res = await fetch(`${API_URL}/account/delete/status/${userId}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const json = await res.json().catch(() => ({}));
  return normalizeStatus(json, userId);
}

export async function apiRequestAccountDelete(userId: number): Promise<AccountDeleteStatus> {
  const res = await fetch(`${API_URL}/account/delete/request/${userId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const json = await res.json().catch(() => ({}));
  return normalizeStatus(json, userId);
}

export async function apiCancelAccountDelete(userId: number): Promise<AccountDeleteStatus> {
  const res = await fetch(`${API_URL}/account/delete/cancel/${userId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }

  const json = await res.json().catch(() => ({}));
  return normalizeStatus(json, userId);
}