// src/features/coach/api/coach_external_events.ts
import { API_URL } from "@/shared/config";
import type {
  ExternalEvent
} from "@/features/coach/types/prefsTypes";



type ListResponse = {
  success: boolean;
  events: ExternalEvent[];
};

type SaveResponse = {
  success: boolean;
  deleted: number;
  inserted: number;
  count: number;
};

export async function apiGetExternalEvents(userId: number): Promise<ExternalEvent[]> {
  const url = `${API_URL}/coach-external-events/${userId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load external events (${res.status})`);
  }
  const json = (await res.json()) as ListResponse;
  return json.events ?? [];
}

export async function apiSaveExternalEvents(
  userId: number,
  events: ExternalEvent[],
): Promise<SaveResponse> {
  const url = `${API_URL}/coach-external-events/${userId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save external events: ${text}`);
  }
  return (await res.json()) as SaveResponse;
}