"use server";

import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  API_URL,
  MAINTENANCE_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from "@/app/shared/config";

async function verifyAdmin() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Neautorizovaný prístup");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_uid", user.id)
    .single();

  if (profile?.role !== "ADMIN") throw new Error("Zakázané: Nie ste admin");
  return user;
}

export async function updateMaintenanceMode(
  active: boolean,
  msgSk: string,
  msgCs: string,
  msgEn: string,
) {
  await verifyAdmin();
  const supabase = await getSupabaseServer();

  const { data: currentSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single();

  const wasActive = currentSettings?.value?.active === true;

  const newValue = {
    active,
    message: { sk: msgSk, cs: msgCs, en: msgEn },
    force_logout_at: currentSettings?.value?.force_logout_at || null 
  };

  const { error } = await supabase
    .from("app_settings")
    .update({ value: newValue })
    .eq("key", "maintenance_mode");

  if (error) throw new Error(error.message);

  if (wasActive && !active) {
    try {
      await sendGlobalNotification({
        messages: {
          sk: { 
            title: "Sme späť! 🚀", 
            body: "Údržba bola úspešne ukončená. Aplikácia je opäť plne funkčná.", 
            url: "/activities" 
          },
          cs: {
            title: "Jsme zpět! 🚀",
            body: "Údržba byla úspěšně ukončena. Aplikace je opět plně funkční.",
            url: "/activities"
          },
          en: { 
            title: "We are back! 🚀", 
            body: "Maintenance is complete. The app is fully functional again.", 
            url: "/activities" 
          }
        }
      });
    } catch (notificationError) {
      console.error("Notifikácia po údržbe zlyhala, ale stav bol zmenený:", notificationError);
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function sendGlobalNotification(payload: any) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/notifications/global`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Chyba pri odosielaní");

  return { success: true, result };
}

type BroadcastTexts = Record<string, { title: string; body: string }>;

// návrh broadcastu v SK, CS a EN zo zadania (AI na BE)
export async function draftBroadcast(brief: string) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/notifications/global/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify({ brief }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.detail || result?.code || "Návrh zlyhal");
  }
  return result.messages as BroadcastTexts;
}

// návrh CS a EN textu broadcastu zo slovenčiny (AI na BE)
export async function translateBroadcast(title: string, body: string) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/notifications/global/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify({ title, body }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.detail || result?.code || "Preklad zlyhal");
  }
  return result.messages as BroadcastTexts;
}

export async function triggerMaintenanceTask(task: string) {
  await verifyAdmin();

  const response = await fetch(
    `${API_URL}/trigger/manual`,
    {
      method: "POST",
      headers: {
        "x-api-key": MAINTENANCE_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "manual", task }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Úloha zlyhala");
  }

  return await response.json();
}

export async function getSystemDiagnostics() {
  await verifyAdmin();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const [resUsers, resPush, resStrava, resSubs] = await Promise.all([
      supabaseAdmin.from("users").select("id, mail_address, auth_uid"),
      supabaseAdmin.from("push_notifications").select("user_id"),
      supabaseAdmin.from("strava_accounts").select("user_id, athlete_id").not("athlete_id", "is", null),
      supabaseAdmin.from("app_user_subscriptions").select("user_id, tier_code").eq("status", "active"),
    ]);

    const users = resUsers.data || [];
    const pushSubs = resPush.data || [];
    const stravaAccounts = resStrava.data || [];
    const activeSubs = resSubs.data || [];

    const pushUserIds = new Set(pushSubs.map((p) => p.user_id));
    const stravaUsers = new Map(stravaAccounts.map((s) => [s.user_id, s.athlete_id]));
    const subsUsers = new Map(activeSubs.map((s) => [s.user_id, s.tier_code]));

    const tiers = activeSubs.reduce((acc: Record<string, number>, sub) => {
      acc[sub.tier_code] = (acc[sub.tier_code] || 0) + 1;
      return acc;
    }, {});

    const userDetails = users
      .map((u: any) => ({
        id: u.id, 
        email: u.mail_address || `Neznámy mail (ID: #${u.id})`,
        hasPush: pushUserIds.has(u.id),
        stravaId: stravaUsers.get(u.id) || null,
        tier: subsUsers.get(u.id) || "free",
      }))
      .sort((a, b) => b.id - a.id);

    return {
      totalUsers: users.length,
      pushSubscribers: pushUserIds.size,
      stravaConnected: stravaUsers.size,
      activeSubsTotal: activeSubs.length,
      tiers,
      userDetails,
      serverTime: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("[Diagnostics Error]:", error);
    throw new Error("Chyba diagnostiky: " + error.message);
  }
}

export async function getMaintenanceSettings() {
  await verifyAdmin();
  const supabase = await getSupabaseServer();
  
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single();

  if (error) {
    console.error("Chyba pri načítaní maintenance statusu:", error);
    return null;
  }
  
  return data?.value || null;
}

export async function forceServerSignOut() {
  const supabase = await getSupabaseServer();
  
  // 1. Zneplatníme session cez štandardný Supabase proces
  await supabase.auth.signOut();

  // 2. NUKLEÁRNY ÚDER NA SERVERI (pretože JS na klientovi HttpOnly cookies nezmaže)
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  allCookies.forEach((cookie) => {
    // Ak cookie patrí Supabase auth systému (začína na sb-), natvrdo ju odstránime
    if (cookie.name.startsWith("sb-")) {
      cookieStore.delete(cookie.name);
    }
  });

  return { success: true };
}

export async function listUsersLite() {
  await verifyAdmin();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, mail_address")
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((u: any) => ({
    id: u.id,
    email: u.mail_address || `Neznámy mail (ID: #${u.id})`,
  }));
}

/* ---------- STRAVA ADMIN OVERRIDE ---------- */

export async function getStravaOverride(userId: number) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/api/strava/admin/override/${userId}`, {
    method: "GET",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Nepodarilo sa načítať override");
  }
  return result?.override ?? null;
}

export async function setStravaOverride(userId: number, days: number, note: string) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/api/strava/admin/override/${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify({ days, note: note || null }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Nepodarilo sa nastaviť override");
  }
  return result;
}

export async function clearStravaOverride(userId: number) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/api/strava/admin/override/${userId}`, {
    method: "DELETE",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Nepodarilo sa vymazať override");
  }
  return result;
}

export async function getStravaAdminStatus(userId: number) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/api/strava/admin/status/${userId}`, {
    method: "GET",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Nepodarilo sa načítať stav");
  }
  return result?.status ?? null;
}

export async function clearStravaReconnectCooldown(userId: number) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/api/strava/admin/clear-cooldown/${userId}`, {
    method: "POST",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Nepodarilo sa zrušiť cooldown");
  }
  return result;
}

export async function sendUserNotification(userIds: number[], payload: any) {
  await verifyAdmin();

  if (!userIds || userIds.length === 0) {
    throw new Error("Nie je vybraný žiadny používateľ");
  }

  const response = await fetch(`${API_URL}/notifications/user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify({
      user_ids: userIds,
      ...payload,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || "Chyba pri odosielaní notifikácie");
  }

  return { success: true, result };
}

/* ---------- APP SUBSCRIPTION ADMIN ---------- */

export async function listAppSubscriptionTiersAdmin() {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/app/subscription/tiers`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa načítať zoznam tierov");
  }
  return result.items ?? [];
}

export async function getAppSubscriptionStatusAdmin(userId: number) {
  await verifyAdmin();

  const response = await fetch(
    `${API_URL}/app/subscription/status/${userId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MAINTENANCE_API_KEY as string,
      },
      cache: "no-store",
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa načítať stav predplatného");
  }
  return result.status ?? null;
}

export async function setAppSubscriptionTierAdmin(
  userId: number,
  tierCode: string,
  opts?: { periodEndIso?: string | null; note?: string | null },
) {
  await verifyAdmin();

  const response = await fetch(
    `${API_URL}/app/subscription/set-tier/${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MAINTENANCE_API_KEY as string,
      },
      body: JSON.stringify({
        tier_code: tierCode,
        ...(opts?.periodEndIso ? { period_end: opts.periodEndIso } : {}),
        ...(opts?.note ? { note: opts.note } : {}),
      }),
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa nastaviť predplatné");
  }
  return result;
}

export async function cancelScheduledSubscriptionChangeAdmin(userId: number) {
  await verifyAdmin();

  const response = await fetch(
    `${API_URL}/app/subscription/cancel-scheduled/${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MAINTENANCE_API_KEY as string,
      },
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa zrušiť naplánovanú zmenu");
  }
  return result;
}

export async function getActivitiesWrappedAdminStatus(userId: number) {
  await verifyAdmin();
  const response = await fetch(
    `${API_URL}/activities-wrapped/admin/status/${userId}`,
    {
      method: "GET",
      headers: { "x-api-key": MAINTENANCE_API_KEY as string },
      cache: "no-store",
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa načítať stav wrapped");
  }
  return result;
}

export async function unlockActivitiesWrappedAdmin(
  userId: number,
  label: string,
  validDays: number,
) {
  await verifyAdmin();
  const response = await fetch(
    `${API_URL}/activities-wrapped/admin/unlock/${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MAINTENANCE_API_KEY as string,
      },
      body: JSON.stringify({ label: label || null, valid_days: validDays }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.detail || "Nepodarilo sa odomknúť wrapped");
  }
  return result;
}
// ---------------- Welcome Week (uvítací týždeň) ----------------

export async function getWelcomeWeekAdminStatus(userId: number) {
  await verifyAdmin();
  const response = await fetch(`${API_URL}/welcome-week/admin/status/${userId}`, {
    method: "GET",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa načítať uvítací týždeň");
  }
  return result;
}

export async function setWelcomeWeekAdmin(
  userId: number,
  days: number,
  start: string | null,
  note: string,
) {
  await verifyAdmin();
  const response = await fetch(`${API_URL}/welcome-week/admin/set/${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify({ days, start: start || null, note: note || null }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || result?.code || "Nepodarilo sa nastaviť uvítací týždeň");
  }
  return result;
}

export async function clearWelcomeWeekAdmin(userId: number) {
  await verifyAdmin();
  const response = await fetch(`${API_URL}/welcome-week/admin/clear/${userId}`, {
    method: "POST",
    headers: { "x-api-key": MAINTENANCE_API_KEY as string },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.detail || "Nepodarilo sa zrušiť uvítací týždeň");
  }
  return result;
}

/* ---------- PRIPOMIENKOVÉ E-MAILY (admin-outreach) ---------- */
// PREČO vracať chybu v objekte a nie throw: Next v produkcii text chyby zo
// server action skryje – panel by nevedel povedať, či chýba SMTP alebo už bolo poslané.

async function outreachFetch(path: string, init: RequestInit = {}) {
  await verifyAdmin();
  const response = await fetch(`${API_URL}/admin-outreach${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    return { success: false, error_code: `http_${response.status}` };
  }
  return result;
}

export async function getOutreachCandidates() {
  return outreachFetch("/candidates");
}

// steps = zaškrtnuté kroky v maile; bez nich BE vyberie podľa toho, čo userovi chýba
export async function getOutreachDraft(userId: number, steps?: string[]) {
  const q = steps ? `?steps=${encodeURIComponent(steps.join(","))}` : "";
  return outreachFetch(`/draft/${userId}${q}`);
}

export async function sendOutreachEmail(userId: number, subject: string, body: string, force: boolean) {
  return outreachFetch(`/send/${userId}`, {
    method: "POST",
    body: JSON.stringify({ subject, body, force }),
  });
}

export async function getOutreachTemplates() {
  return outreachFetch("/templates");
}

export async function saveOutreachTemplates(templates: Record<string, Record<string, string>>) {
  return outreachFetch("/templates", {
    method: "PUT",
    body: JSON.stringify({ templates }),
  });
}

export async function connectZohoMail(code: string) {
  return outreachFetch("/zoho/connect", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/* ---------- FUNKCIE (feature flags: off / admin / beta / all) ---------- */

async function featuresFetch(path: string, init: RequestInit = {}) {
  await verifyAdmin();
  const response = await fetch(`${API_URL}/features/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MAINTENANCE_API_KEY as string,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    return { success: false, error_code: `http_${response.status}` };
  }
  return result;
}

export async function getFeatureFlags() {
  return featuresFetch("");
}

export async function setFeatureStage(key: string, stage: string) {
  return featuresFetch("/stage", {
    method: "PUT",
    body: JSON.stringify({ key, stage }),
  });
}

// user = ID alebo e-mail
export async function addBetaUser(user: string) {
  return featuresFetch("/beta", {
    method: "POST",
    body: JSON.stringify({ user }),
  });
}

export async function removeBetaUser(userId: number) {
  return featuresFetch(`/beta/${userId}`, { method: "DELETE" });
}
