//"use client";

import { API_URL } from "@/lib/config";

export async function getUserId(authUid: string): Promise<number | null> {

  const res = await fetch(`${API_URL}/users/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_uid: authUid }),
  });

  const json = await res.json();
  console.log("➡️ getUserId: odpoveď z backendu =", json);

  if (!json.success) return null;
  return json.user_id;
}


