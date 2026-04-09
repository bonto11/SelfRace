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

  // Stiahneme reálne dáta, nielen "počty", aby sme vedeli spraviť zoznam
  const [
    { data: users },
    { data: pushSubs },
    { data: stravaAccounts },
    { data: activeSubs }
  ] = await Promise.all([
    supabase.from('users').select('*'), // Vezmeme všetko, nech máme email alebo aspoň user_uid
    supabase.from('push_notifications').select('user_id'),
    supabase.from('strava_account').select('user_id, athlete_id').not('athlete_id', 'is', null),
    supabase.from('app_user_subscriptions').select('user_id, tier_code').eq('status', 'active')
  ]);

  const activeSubsList = activeSubs || [];
  const tiers = activeSubsList.reduce((acc: Record<string, number>, sub) => {
    acc[sub.tier_code] = (acc[sub.tier_code] || 0) + 1;
    return acc;
  }, {});

  // Namapujeme si to do pamäte pre bleskové vyhľadávanie
  const pushUserIds = new Set((pushSubs || []).map(p => p.user_id));
  const stravaUsers = new Map((stravaAccounts || []).map(s => [s.user_id, s.athlete_id]));
  const subsUsers = new Map(activeSubsList.map(s => [s.user_id, s.tier_code]));

  // Vytvoríme konkrétny prehľad používateľov
  const userDetails = (users || []).map((u: any) => ({
    id: u.id,
    email: u.email || u.user_uid || `Neznámy (User #${u.id})`,
    hasPush: pushUserIds.has(u.id),
    stravaId: stravaUsers.get(u.id) || null,
    tier: subsUsers.get(u.id) || "free"
  })).sort((a, b) => {
    // Zoradenie: Platiaci idú prví, potom tí čo majú Stravu, potom podľa ID
    if (a.tier !== 'free' && b.tier === 'free') return -1;
    if (a.tier === 'free' && b.tier !== 'free') return 1;
    if (a.stravaId && !b.stravaId) return -1;
    if (!a.stravaId && b.stravaId) return 1;
    return b.id - a.id;
  });

  return {
    totalUsers: users?.length || 0,
    pushSubscribers: pushUserIds.size, // Počet unikátnych používateľov s notifikáciami
    stravaConnected: stravaAccounts?.length || 0,
    activeSubsTotal: activeSubsList.length,
    tiers,
    userDetails,
    serverTime: new Date().toISOString(),
  };
}
