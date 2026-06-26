import { callBackend } from "@/app/shared/utils/callBackend";

export type StickyNote = {
  id: number;
  type: "sticky";
  text: string;
  created_at: string;
  updated_at: string;
};

export type EphemeralNote = {
  id: number;
  type: "ephemeral";
  text: string;
  applied: boolean;
  created_at: string;
};

export type CoachNotesData = {
  sticky: StickyNote[];
  ephemeral_history: EphemeralNote[];
  pending_ephemeral: EphemeralNote | null;
  sticky_slots_used: number;
  sticky_slots_max: number;
};

export async function apiGetCoachNotes(userId: number): Promise<CoachNotesData | null> {
  const res = await callBackend<any>(`/coach/notes/${userId}`, { method: "GET", cache: "no-store" });
  return res?.success ? res.data : null;
}

export async function apiCreateSticky(userId: number, text: string): Promise<{ success: boolean; data?: StickyNote; error_code?: string; message?: string }> {
  return callBackend(`/coach/notes/${userId}/sticky`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function apiUpdateSticky(userId: number, noteId: number, text: string): Promise<{ success: boolean; message?: string }> {
  return callBackend(`/coach/notes/${userId}/sticky/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function apiDeleteNote(userId: number, noteId: number): Promise<{ success: boolean; message?: string }> {
  return callBackend(`/coach/notes/${userId}/${noteId}`, { method: "DELETE" });
}

export async function apiAddEphemeral(userId: number, text: string): Promise<{ success: boolean; data?: EphemeralNote; message?: string }> {
  return callBackend(`/coach/notes/${userId}/ephemeral`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
