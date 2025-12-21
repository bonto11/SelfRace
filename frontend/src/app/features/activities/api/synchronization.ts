// src/features/activities/api/activities.ts
import { API_URL } from "@/app/shared/config";
import { robustJson } from "@/app/features/coach/api/_api_utils";
import {
  SyncActivitiesOptions,
  SyncActivitiesStats,
  SyncActivitiesResponse,
} from "@/app/features/activities/types/synchronization";

export async function apiSyncActivities(
  userId: number,
  opts: SyncActivitiesOptions = {}
): Promise<SyncActivitiesStats> {
  if (!API_URL) throw new Error("Missing API_URL for apiSyncActivities");

  const body = {
    force_last_days: opts.forceLastDays ?? 30,
    fetch_details: opts.fetchDetails ?? true,
  };

  const res = await fetch(`${API_URL}/synchronization/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = (await robustJson(res)) as SyncActivitiesResponse;

  if (!res.ok || !json?.success) {
    const msg =
      (json as any)?.detail ||
      (json as any)?.error ||
      json?.note ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.stats;
}
