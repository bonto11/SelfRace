// src/features/coach/api/coach.ts
import { API_URL } from "@/shared/config";

type AnalyzePayload = {
  weeks: number;
  goal: string;
  primary_sports: string[];
};

export async function analyzeCoach(userId: number, payload: AnalyzePayload) {
  const res = await fetch(`${API_URL}/coach/analyze/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function sendCoachFeedback(userId: number, body: any) {
  const res = await fetch(`${API_URL}/coach/feedback/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.detail || `HTTP ${res.status}`);
  }
  return json;
}
