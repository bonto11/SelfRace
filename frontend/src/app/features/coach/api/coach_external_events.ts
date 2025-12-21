// src/features/coach/api/coach_external_events.ts
import { API_URL } from "@/app/shared/config";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";

type ListResponse = {
  success: boolean;
  events: ExternalEvent[];
};

type WindowListResponse = {
  success: boolean;
  events: ExternalEvent[];
};

type SaveResponse = {
  success: boolean;
  deleted: number;
  inserted: number;
  count: number;
};

export async function apiGetExternalEvents(
  userId: number
): Promise<ExternalEvent[]> {
  const url = `${API_URL}/coach-external-events/${userId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load external events (${res.status})`);
  }
  const json = (await res.json()) as ListResponse;
  return json.events ?? [];
}

/**
 * Načítanie „expandovaných“ externých eventov v danom období.
 * fromIso / toIso: "YYYY-MM-DD"
 */
export async function apiGetExternalEventsWindow(
  userId: number,
  fromIso: string,
  toIso: string
): Promise<ExternalEvent[]> {
  const params = new URLSearchParams({ from: fromIso, to: toIso });
  const url = `${API_URL}/coach-external-events/${userId}/window?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load external events window (${res.status})`);
  }
  const json = (await res.json()) as WindowListResponse;
  return json.events ?? [];
}

export async function apiSaveExternalEvents(
  userId: number,
  events: ExternalEvent[]
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
