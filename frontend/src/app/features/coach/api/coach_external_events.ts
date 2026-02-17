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

export async function apiGetExternalEvents(userId: number): Promise<ExternalEvent[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-external-events/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<ListResponse>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.eventsLoadFailed");
    }

    return json.events ?? [];
  } catch (e: any) {
    console.error("[Coach][apiGetExternalEvents] ERROR", e);
    throw new Error("api.coach.eventsLoadFailed");
  }
}

export async function apiGetExternalEventsWindow(
  userId: number,
  fromIso: string,
  toIso: string
): Promise<ExternalEvent[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!fromIso || !toIso) return [];

  const params = new URLSearchParams({ from: fromIso, to: toIso });
  const path = `/coach-external-events/${encodeURIComponent(String(userId))}/window?${params.toString()}`;

  try {
    const json = await callBackend<WindowListResponse>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.eventsLoadFailed");
    }

    return json.events ?? [];
  } catch (e: any) {
    console.error("[Coach][apiGetExternalEventsWindow] ERROR", e);
    throw new Error("api.coach.eventsLoadFailed");
  }
}

export async function apiSaveExternalEvents(
  userId: number,
  events: ExternalEvent[]
): Promise<SaveResponse> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-external-events/${encodeURIComponent(String(userId))}`;

  const payloadEvents = (events ?? []).map((e) => {
    const out: any = { ...e };
    const wi =
      typeof (out.weekday_int) === "number"
        ? out.weekday_int
        : typeof (out.weekday) === "number"
          ? out.weekday
          : out.weekday_int;
    out.weekday_int = wi ?? null;
    return out as ExternalEvent;
  });

  try {
    const json = await callBackend<SaveResponse>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: payloadEvents }),
    });

    if (!json?.success) {
      throw new Error("api.coach.eventsSaveFailed");
    }

    return json;
  } catch (e: any) {
    console.error("[Coach][apiSaveExternalEvents] ERROR", e);
    throw new Error("api.coach.eventsSaveFailed");
  }
}