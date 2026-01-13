import { API_URL } from "@/app/shared/config";

export type AccountDeleteStatus = {
  pending: boolean;
  delete_at: string | null; // ISO dátum v UTC alebo s offsetom
};

async function handleJson<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok) {
    let msg = fallbackMsg;
    try {
      const j = await res.json();
      if (j?.detail) msg = String(j.detail);
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function apiGetAccountDeleteStatus(
  userId: number,
): Promise<AccountDeleteStatus> {
  const res = await fetch(
    `${API_URL}/api/account/delete/status?user_id=${userId}`,
    { credentials: "include" },
  );
  return handleJson<AccountDeleteStatus>(res, "Failed to load delete status.");
}

export async function apiRequestAccountDeletion(
  userId: number,
): Promise<AccountDeleteStatus> {
  const res = await fetch(`${API_URL}/api/account/delete/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleJson<AccountDeleteStatus>(
    res,
    "Failed to request account deletion.",
  );
}

export async function apiCancelAccountDeletion(
  userId: number,
): Promise<AccountDeleteStatus> {
  const res = await fetch(`${API_URL}/api/account/delete/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleJson<AccountDeleteStatus>(
    res,
    "Failed to cancel account deletion.",
  );
}