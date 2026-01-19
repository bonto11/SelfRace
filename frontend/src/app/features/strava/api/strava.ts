// app/features/strava/api/strava.ts
import { API_URL } from "@/app/shared/config";

export type StravaStatus = {
  connected: boolean;
  athlete_id: number | null;
  scopes: string[];
  expires_at: string | null;
};

export async function apiGetStravaStatus(userId: number): Promise<StravaStatus> {
  const res = await fetch(`${API_URL}/api/strava/status?user_id=${userId}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load Strava status");
  }

  return (await res.json()) as StravaStatus;
}

export async function apiDisconnectStrava(userId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/strava/disconnect?user_id=${userId}`, {
    method: "POST",
    credentials: "include",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof (json as any)?.detail === "string"
        ? (json as any).detail
        : "Failed to disconnect Strava";
    throw new Error(msg);
  }

  return { ok: true };
}