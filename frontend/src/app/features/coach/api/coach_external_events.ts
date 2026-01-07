// src/features/coach/api/coach_external_events.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";

type ListResponse = {
  success: boolean;
  events: ExternalEvent[];
  detail?: string | null;
  error?: string | null;
};

type WindowListResponse = {
  success: boolean;
  events: ExternalEvent[];
  detail?: string | null;
  error?: string | null;
};

type SaveResponse = {
  success: boolean;
  deleted: number;
  inserted: number;
  count: number;
  detail?: string | null;
  error?: string | null;
};

export async function apiGetExternalEvents(
  userId: number
): Promise<ExternalEvent[]> {
  if (!userId) throw new Error("Missing userId in apiGetExternalEvents");

  const path = `/coach-external-events/${encodeURIComponent(String(userId))}`;

  let json: ListResponse;
  try {
    json = await callBackend<ListResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiGetExternalEvents] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (external events): ${String(e)}`);
  }

  if (!json?.success) {
    const msg = json.detail || json.error || "Failed to load external events";
    throw new Error(msg);
  }

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
  if (!userId) throw new Error("Missing userId in apiGetExternalEventsWindow");
  if (!fromIso || !toIso)
    throw new Error("fromIso and toIso are required in apiGetExternalEventsWindow");

  const params = new URLSearchParams({
    from: fromIso,
    to: toIso,
  });

  const path = `/coach-external-events/${encodeURIComponent(
    String(userId)
  )}/window?${params.toString()}`;

  let json: WindowListResponse;
  try {
    json = await callBackend<WindowListResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiGetExternalEventsWindow] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (external events window): ${String(e)}`);
  }

  if (!json?.success) {
    const msg =
      json.detail || json.error || "Failed to load external events window";
    throw new Error(msg);
  }

  return json.events ?? [];
}

export async function apiSaveExternalEvents(
  userId: number,
  events: ExternalEvent[]
): Promise<SaveResponse> {
  if (!userId) throw new Error("Missing userId in apiSaveExternalEvents");

  const path = `/coach-external-events/${encodeURIComponent(String(userId))}`;

  let json: SaveResponse;
  try {
    json = await callBackend<SaveResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
  } catch (e: any) {
    console.error("[Coach][apiSaveExternalEvents] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (save external events): ${String(e)}`);
  }

  if (!json?.success) {
    const msg =
      json.detail || json.error || "Failed to save external events to backend";
    throw new Error(msg);
  }

  return json;
}