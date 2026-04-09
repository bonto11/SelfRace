"use server";

import { getSupabaseServer } from "@/app/shared/utils/supabaseServer";
import { revalidatePath } from "next/cache";
import { API_URL, MAINTENANCE_API_KEY, CRON_SECRET, FRONTEND_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY} from "@/app/shared/config"; 

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
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const [
      resUsers,
      resPush,
      resStrava,
      resSubs
    ] = await Promise.all([
      // Ak sa tvoj stĺpec volá user_id, musíme ho tak aj vyžiadať
      supabaseAdmin.from('users').select('user_id, email, user_uid'), 
      supabaseAdmin.from('push_notifications').select('user_id'),
      supabaseAdmin.from('strava_account').select('user_id, athlete_id').gt('athlete_id', 0),
      supabaseAdmin.from('app_user_subscriptions').select('user_id, tier_code').eq('status', 'active')
    ]);

    // DEBUG: Ak je niekde chyba, vypíš ju do logov (uvidíš v Railway/Vercel logoch)
    if (resUsers.error) console.error("Users Error:", resUsers.error);
    if (resStrava.error) console.error("Strava Error:", resStrava.error);

    const users = resUsers.data || [];
    const pushSubs = resPush.data || [];
    const stravaAccounts = resStrava.data || [];
    const activeSubs = resSubs.data || [];

    const pushUserIds = new Set(pushSubs.map(p => p.user_id));
    const stravaUsers = new Map(stravaAccounts.map(s => [s.user_id, s.athlete_id]));
    const subsUsers = new Map(activeSubs.map(s => [s.user_id, s.tier_code]));

    const tiers = activeSubs.reduce((acc: Record<string, number>, sub) => {
      acc[sub.tier_code] = (acc[sub.tier_code] || 0) + 1;
      return acc;
    }, {});

    const userDetails = users.map((u: any) => ({
      // TU JE ZMENA: Používame u.user_id namiesto u.id
      id: u.user_id, 
      email: u.email || u.user_uid || `User #${u.user_id}`,
      hasPush: pushUserIds.has(u.user_id),
      stravaId: stravaUsers.get(u.user_id) || null,
      tier: subsUsers.get(u.user_id) || "free"
    })).sort((a, b) => b.id - a.id);

    return {
      totalUsers: users.length,
      pushSubscribers: pushUserIds.size,
      stravaConnected: stravaUsers.size,
      activeSubsTotal: activeSubs.length,
      tiers,
      userDetails,
      serverTime: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("[Diagnostics Error]:", error);
    throw new Error("Chyba diagnostiky: " + error.message);
  }
}
