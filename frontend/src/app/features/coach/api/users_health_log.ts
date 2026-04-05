// src/features/coach/api/users_health_log.ts
import { callBackend } from "@/app/shared/utils/callBackend";

type ApiFail = { success: false; detail?: string; error_code?: string; message?: string };

export type HealthLogRecord = {
  id?: number;
  user_id?: number;
  event_type: "injury" | "illness" | "fatigue" | "menstruation";
  status?: "active" | "resolved";
  severity: number; // 1-10
  start_date?: string;
  end_date?: string | null;
  details?: Record<string, any>;
  notes?: string | null;
  created_at?: string;
};

/** GET: Aktívne problémy (Zobrazenie vo Widgete) */
export async function apiGetActiveHealthLogs(userId: number): Promise<HealthLogRecord[] | null> {
  if (!userId) return null;
  const path = `/health-log/active/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    if (!json || json.success === false) return null;
    return json.data || [];
  } catch (e) {
    console.error("[HealthLog][GET active] error", e);
    return null;
  }
}

/** GET: Celá história (Pre nejaký History Modal/Page) */
export async function apiGetHealthHistory(userId: number): Promise<HealthLogRecord[] | null> {
  if (!userId) return null;
  const path = `/health-log/history/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    if (!json || json.success === false) return null;
    return json.data || [];
  } catch (e) {
    console.error("[HealthLog][GET history] error", e);
    return null;
  }
}

/** POST: Uložiť jeden alebo viacero záznamov naraz */
export async function apiSaveHealthLogs(
  userId: number,
  logs: HealthLogRecord[]
): Promise<HealthLogRecord[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!logs || logs.length === 0) return [];

  const path = `/health-log/save/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs }),
    });

    if (!json || json.success === false) {
      throw new Error(json.message || json.detail || "Failed to save health logs");
    }
    return json.data;
  } catch (e) {
    console.error("[HealthLog][POST save] error", e);
    throw e;
  }
}

/** PUT: Označiť záznam za vyriešený (Ukončiť chorobu/zranenie) */
export async function apiResolveHealthLog(
  userId: number,
  logId: number,
  endDate?: string
): Promise<HealthLogRecord | null> {
  if (!userId || !logId) throw new Error("api.common.missingUserAuth");
  
  let path = `/health-log/resolve/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(logId))}`;
  if (endDate) {
      path += `?end_date=${encodeURIComponent(endDate)}`;
  }

  try {
    const json = await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
    });

    if (!json || json.success === false) {
      throw new Error(json.message || json.detail || "Failed to resolve health log");
    }
    return json.data;
  } catch (e) {
    console.error("[HealthLog][PUT resolve] error", e);
    throw e;
  }
}

/** DELETE: Vymazať záznam */
export async function apiDeleteHealthLog(userId: number, logId: number): Promise<boolean> {
  if (!userId || !logId) throw new Error("api.common.missingUserAuth");
  
  const path = `/health-log/delete/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(logId))}`;

  try {
    const json = await callBackend<any>(path, { method: "DELETE", cache: "no-store" });
    return json?.success === true;
  } catch (e) {
    console.error("[HealthLog][DELETE] error", e);
    throw e;
  }
}

/** POST: Spustenie adaptácie plánu na základe aktuálnych zdravotných dát */
export async function apiAdaptPlanForHealth(userId: number): Promise<any> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/health-log/adapt-plan/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
    });

    if (!json || json.success === false) {
      throw new Error(json.message || "Failed to trigger plan adaptation");
    }
    return json.data;
  } catch (e) {
    console.error("[HealthLog][POST adapt plan] error", e);
    throw e;
  }
}