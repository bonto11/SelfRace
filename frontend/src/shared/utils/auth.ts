// src/shared/utils/auth.ts
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";

/** Získa prihláseného usera (alebo null). Server-only. */
export async function getAuthUser() {
  const supabase = getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Vyžaduje prihlásenie – inak presmeruje. Použi v (protected)/layout.tsx */
export async function requireAuth(redirectTo: string = "/signin") {
  const user = await getAuthUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function signOut(redirectTo = "/signin") {
  try {
    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ event: "SIGNED_OUT" }),
    });
  } catch {}

  // client cleanup
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}

  try {
    document.cookie.split(";").forEach(c => {
      const [name] = c.split("="); if (!name) return;
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}

  try {
    if ("caches" in self) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch {}

  try { localStorage.setItem("up:logout_at", String(Date.now())); } catch {}

  if (typeof window !== "undefined") window.location.replace(redirectTo);
}