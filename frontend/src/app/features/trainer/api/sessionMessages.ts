import { callBackend } from "@/app/shared/utils/callBackend";

// Vlákna k tréningom tréner ↔ zverenec (BE: Routes/session_messages.py).
// userId = zverenec (vlastník tréningu) – aj keď píše tréner počas prezerania.
// error_code sa prekladá cez trainer.thread.errors.<code>.

export type ThreadMessage = {
  id: number;
  body: string;
  created_at: string;
  /** napísal ju aktuálny user */
  mine: boolean;
  author_role: "athlete" | "trainer";
};

export type SessionThread = {
  /** false = žiadny tréner a žiadna história – sekcia sa neukáže */
  enabled: boolean;
  role?: "athlete" | "trainer";
  /** písať sa dá len pri aktívnej spolupráci */
  can_post?: boolean;
  messages?: ThreadMessage[];
};

export type ThreadTarget = { planId?: number | null; activityId?: number | null };

export type UnreadThread = {
  plan_id: number | null;
  activity_id: number | null;
  count: number;
  /** deň tréningu (bodka v kalendári, cieľ odkazu) */
  date: string | null;
  last_at: string;
};

export type TrainerUnreadAthlete = {
  athlete_user_id: number;
  name: string;
  count: number;
  last_at: string;
  /** najnovšie vlákno – kam ikonka v hlavičke trénera skočí */
  latest: UnreadThread;
};

/**
 * Kam otvoriť vlákno: veľký kalendár na dni tréningu s rozbaleným
 * tréningom (zrkadlo BE thread_path – rovnaký tvar ako v pushi).
 */
export function threadPath(t: Pick<UnreadThread, "plan_id" | "activity_id" | "date">): string {
  const q = new URLSearchParams();
  if (t.date) q.set("date", t.date);
  if (t.plan_id) q.set("plan", String(t.plan_id));
  else if (t.activity_id) q.set("activity", String(t.activity_id));
  const qs = q.toString();
  return `/calendar${qs ? `?${qs}` : ""}`;
}

const base = (userId: number) => `/session-messages/${encodeURIComponent(String(userId))}`;

function targetQuery({ planId, activityId }: ThreadTarget): string {
  if (planId) return `plan_id=${encodeURIComponent(String(planId))}`;
  if (activityId) return `activity_id=${encodeURIComponent(String(activityId))}`;
  return "";
}

export async function apiGetSessionThread(
  userId: number,
  target: ThreadTarget,
): Promise<SessionThread> {
  const q = targetQuery(target);
  if (!userId || !q) return { enabled: false };
  try {
    const json = await callBackend<any>(`${base(userId)}/thread?${q}`, {
      method: "GET",
      cache: "no-store",
    });
    return (json?.success && json.data) || { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export async function apiPostSessionMessage(
  userId: number,
  target: ThreadTarget,
  body: string,
): Promise<{ ok: true; message: ThreadMessage } | { ok: false; errorCode: string }> {
  try {
    const json = await callBackend<any>(`${base(userId)}/thread`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan_id: target.planId || null,
        activity_id: target.planId ? null : target.activityId || null,
        body,
      }),
    });
    if (!json?.success) return { ok: false, errorCode: String(json?.error_code || "thread_send_failed") };
    return { ok: true, message: json.data as ThreadMessage };
  } catch {
    return { ok: false, errorCode: "thread_send_failed" };
  }
}

export async function apiGetUnreadThreads(
  userId: number,
): Promise<{ enabled: boolean; threads: UnreadThread[] }> {
  try {
    const json = await callBackend<any>(`${base(userId)}/unread`, {
      method: "GET",
      cache: "no-store",
    });
    const d = json?.data;
    return {
      enabled: !!d?.enabled,
      threads: Array.isArray(d?.threads) ? d.threads : [],
    };
  } catch {
    return { enabled: false, threads: [] };
  }
}

/** Tréner: neprečítané správy od všetkých zverencov (userId = tréner sám). */
export async function apiGetTrainerUnread(
  userId: number,
): Promise<{ enabled: boolean; athletes: TrainerUnreadAthlete[] }> {
  try {
    const json = await callBackend<any>(
      `/session-messages/trainer-unread/${encodeURIComponent(String(userId))}`,
      { method: "GET", cache: "no-store" },
    );
    const d = json?.data;
    return {
      enabled: !!d?.enabled,
      athletes: Array.isArray(d?.athletes) ? d.athletes : [],
    };
  } catch {
    return { enabled: false, athletes: [] };
  }
}
