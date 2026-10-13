// src/app/features/settings/api/displayName.ts
import { callBackend } from "@/app/shared/utils/callBackend";

type NameOut = { success: boolean; display_name?: string; error_code?: string };

/** Event pre hlavičku (UserMenu) – meno sa zmenilo, prekresli ho bez reloadu. */
export const DISPLAY_NAME_EVENT = "sr:display-name";

export async function apiGetDisplayName(userId: number): Promise<string> {
  const res = await callBackend<NameOut>(`/users/${userId}/name`, { method: "GET", cache: "no-store" });
  return String(res?.display_name ?? "");
}

/** Vráti uložené meno, alebo hodí Error s i18n kľúčom chyby. */
export async function apiSetDisplayName(userId: number, displayName: string): Promise<string> {
  const res = await callBackend<NameOut>(`/users/${userId}/name`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res?.success) {
    throw new Error(`settings.name.errors.${res?.error_code || "save_failed"}`);
  }
  const name = String(res.display_name ?? displayName);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<string>(DISPLAY_NAME_EVENT, { detail: name }));
  }
  return name;
}
