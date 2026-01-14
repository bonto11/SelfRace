// app/features/strava/api/status.ts
import { API_URL } from "@/app/shared/config";

export type StravaStatus = {
  connected: boolean;
  athlete_id: number | null;
  scopes: string[];
  expires_at: string | null;
};

export async function apiGetStravaStatus(
  userId: number,
): Promise<StravaStatus> {
  const res = await fetch(`${API_URL}/api/strava/status?user_id=${userId}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load Strava status");
  }

  return (await res.json()) as StravaStatus;
}