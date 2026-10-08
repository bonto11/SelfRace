import { callBackend } from "@/app/shared/utils/callBackend";

// Živý tréner (BE: Routes/trainer.py, Services/trainer_links.py).
// error_code sa prekladá cez trainer.errors.<code>.

export type TrainerPerson = {
  link_id: number;
  name: string;
  created_at?: string | null;
  since?: string | null;
};

export type TrainerAthlete = {
  link_id: number;
  athlete_user_id: number;
  name: string;
  since?: string | null;
};

export type TrainerSentRequest = {
  link_id: number;
  request_code: string | null;
  created_at?: string | null;
};

export type TrainerOverview = {
  /** funkcia je pre usera zapnutá (BE env TRAINER_USERS) – inak sa UI neukazuje */
  enabled: boolean;
  /** kód, ktorý user pošle trénerovi */
  share_code: string | null;
  /** môj aktívny tréner */
  trainer: TrainerPerson | null;
  /** žiadosti trénerov, ktoré čakajú na moje potvrdenie */
  trainer_requests: TrainerPerson[];
  /** moji zverenci (som tréner) */
  athletes: TrainerAthlete[];
  /** moje žiadosti, ktoré atlét ešte nepotvrdil */
  sent_requests: TrainerSentRequest[];
};

export type TrainerResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string };

const base = (userId: number) => `/trainer/${encodeURIComponent(String(userId))}`;

export async function apiTrainerOverview(userId: number): Promise<TrainerOverview | null> {
  try {
    const json = await callBackend<any>(`${base(userId)}/overview`, {
      method: "GET",
      cache: "no-store",
    });
    const d = json?.data;
    if (!json?.success || !d) return null;
    return {
      enabled: d.enabled === true,
      share_code: d.share_code ?? null,
      trainer: d.trainer ?? null,
      trainer_requests: Array.isArray(d.trainer_requests) ? d.trainer_requests : [],
      athletes: Array.isArray(d.athletes) ? d.athletes : [],
      sent_requests: Array.isArray(d.sent_requests) ? d.sent_requests : [],
    };
  } catch {
    return null;
  }
}

async function post<T>(
  path: string,
  body: Record<string, unknown> | null,
  fallbackCode: string,
): Promise<TrainerResult<T>> {
  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!json?.success) {
      return { ok: false, errorCode: String(json?.error_code || fallbackCode) };
    }
    return { ok: true, data: json?.data as T };
  } catch {
    return { ok: false, errorCode: fallbackCode };
  }
}

export function apiTrainerRegenerateCode(
  userId: number,
): Promise<TrainerResult<{ share_code: string }>> {
  return post(`${base(userId)}/share-code/regenerate`, null, "share_code_failed");
}

export function apiTrainerRequestAthlete(
  userId: number,
  code: string,
): Promise<TrainerResult<{ link_id: number; already_pending?: boolean }>> {
  return post(`${base(userId)}/requests`, { code }, "trainer_request_failed");
}

export function apiTrainerRespond(
  userId: number,
  linkId: number,
  accept: boolean,
): Promise<TrainerResult<{ status: string }>> {
  return post(
    `${base(userId)}/links/${encodeURIComponent(String(linkId))}/respond`,
    { accept },
    "trainer_request_failed",
  );
}

export function apiTrainerEndLink(
  userId: number,
  linkId: number,
): Promise<TrainerResult<{ status: string }>> {
  return post(
    `${base(userId)}/links/${encodeURIComponent(String(linkId))}/end`,
    null,
    "trainer_request_failed",
  );
}
