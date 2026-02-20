// src/features/coach/api/_api_utils.ts
import { API_URL } from "@/app/shared/config";

  const apiUrlSafe = API_URL && !API_URL.includes("undefined") 
      ? API_URL 
      : "https://api.selfrace.com";

export const COACH_API_BASE: string = apiUrlSafe ?? "";

/**
 * Robustné čítanie JSONu – ak odpoveď nie je JSON, vráti text.
 */
export async function robustJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json().catch(() => ({}));
  }
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}
