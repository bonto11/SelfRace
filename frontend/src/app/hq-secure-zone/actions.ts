"use server";

import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";
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
    message: { sk: msgSk, en: msgEn },
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