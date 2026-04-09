"use server";

import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";
import { revalidatePath } from "next/cache";
import { API_URL, MAINTENANCE_API_KEY, CRON_SECRET, FRONTEND_URL } from "@/app/shared/config"; 

async function verifyAdmin() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Neautorizovaný prístup");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_uid", user.id)
    .single();

  if (profile?.role !== "ADMIN") throw new Error("Zakázané: Nie ste admin");
  return user;
}

export async function updateMaintenanceMode(active: boolean, msgSk: string, msgEn: string) {
  await verifyAdmin();
  const supabase = await getSupabaseServer();

  const newValue = {
    active,
    message: { sk: msgSk, en: msgEn }
  };

  const { error } = await supabase
    .from("app_settings")
    .update({ value: newValue })
    .eq("key", "maintenance_mode");

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function sendGlobalNotification(payload: any) {
  await verifyAdmin();

  const response = await fetch(`${API_URL}/scheduled-events/global`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MAINTENANCE_API_KEY as string,
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Chyba pri odosielaní");
  
  return { success: true, result };
}

export async function triggerMaintenanceTask(task: string) {
  await verifyAdmin();

  // URL musí presne kopírovať štruktúru v src/app/api/...
  // Keďže máš api/cron/trigger/route.ts, cesta je /api/cron/trigger
  const response = await fetch(`${FRONTEND_URL}/api/cron/trigger?task=${task}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Úloha zlyhala");
  }

  return await response.json();
}

export async function forceGlobalLogout() {
  await verifyAdmin(); // Bezpečnostná poistka
  const supabase = await getSupabaseServer();

  // 1. Získame aktuálne nastavenia údržby
  const { data: current } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .single();

  // 2. Pridáme k nim aktuálny čas (toto spustí SessionGuard u všetkých klientov)
  const updatedValue = {
    ...current?.value,
    force_logout_at: new Date().toISOString()
  };

  // 3. Uložíme späť do databázy
  const { error } = await supabase
    .from("app_settings")
    .update({ value: updatedValue })
    .eq("key", "maintenance_mode");

  if (error) throw new Error(error.message);

  return { success: true, message: "Signál na odhlásenie bol odoslaný všetkým klientom!" };
}

export async function getSystemDiagnostics() {
  await verifyAdmin();
  const supabase = await getSupabaseServer();

  // Spustíme všetky dotazy súbežne pre maximálnu rýchlosť
  const [
    { count: totalUsers },
    { count: pushSubscribers },
    { count: stravaConnected },
    { data: activeSubs }
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('push_notifications').select('*', { count: 'exact', head: true }),
    supabase.from('strava_account').select('*', { count: 'exact', head: true }).is('deauthorized_at', null),
    supabase.from('app_user_subscriptions').select('tier_code').eq('status', 'active')
  ]);

  // Zosumarizujeme aktívne predplatné podľa "tier_code" (napr. { classic: 10, pro: 5 })
  const tiers = (activeSubs || []).reduce((acc: Record<string, number>, sub) => {
    acc[sub.tier_code] = (acc[sub.tier_code] || 0) + 1;
    return acc;
  }, {});

  return {
    totalUsers: totalUsers || 0,
    pushSubscribers: pushSubscribers || 0,
    stravaConnected: stravaConnected || 0,
    activeSubsTotal: activeSubs?.length || 0,
    tiers,
    serverTime: new Date().toISOString(),
  };
}
