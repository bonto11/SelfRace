import { NextResponse } from 'next/server';
import { API_URL, CRON_SECRET } from "@/app/shared/config";

// 👇 IMPORTUJEME TVOJ SAMOSTATNÝ SÚBOR S TEXTAMI
import { manualGlobalPayload } from './global-payload';

export async function POST(request: Request) {
  // 🛡️ Ochrana 
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task');

  if (!task) {
    return NextResponse.json({ success: false, error: "Chýba parameter 'task'" }, { status: 400 });
  }

  // 👇 Pokus o načítanie tela požiadavky (ak by si to niekedy spúšťal cez Admin Panel)
  let requestBody: any = undefined;
  try {
    requestBody = await request.json();
  } catch (e) {
    // Požiadavka nemá JSON telo, to je v poriadku
  }

  let backendPath = "";
  let payload: any = undefined; 

  // 🚀 Smerovač (Router)
  switch (task) {
    // --- 1. TESTOVACÍ DEV PING (Generuje si čas sám, neposiela novinky) ---
    case "hourly-ping":
      backendPath = "/scheduled-events/global";
      const now = new Date();
      const baHour = new Intl.DateTimeFormat('sk-SK', { timeZone: 'Europe/Bratislava', hour: '2-digit', hour12: false }).format(now).padStart(2, '0');
      const scheduledTime = `${baHour}:00`;
      
      payload = {
        messages: {
          sk: { title: `DEV Ping (${scheduledTime}) ⏱️`, body: `Heartbeat OK.`, url: "/activities" },
          en: { title: `DEV Ping (${scheduledTime}) ⏱️`, body: `Heartbeat OK.`, url: "/activities" }
        }
      };
      break;

    // --- 2. MANUÁLNE GLOBÁLNE OZNÁMENIA (Nové features) ---
    case "global-manual":
      backendPath = "/scheduled-events/global";
      // Ak si poslal texty v requeste (cez Admin Panel), použi ich. 
      // Inak zober tie, čo sú napevno napísané v súbore global-payload.ts.
      payload = requestBody || manualGlobalPayload;
      break;

    // --- 3. OSTATNÉ CRONY (Zostávajú bez zmeny) ---
    case "recovery":
      backendPath = "/scheduled-events/recovery";
      payload = {};
      break;
    case "review":
      backendPath = "/scheduled-events/review";
      payload = {};
      break;
    case "training":
      backendPath = "/scheduled-events/training";
      payload = {};
      break;
    case "weekly-athlete-state":
      backendPath = "/scheduled-events/weekly-athlete-state-refresh";
      payload = { max_users: 5 };
      break;
    
    
    // --- 3. MAINTENANCE (Zostávajú bez zmeny) ---
    
    case "cleanup-expired-activities":
      backendPath = "/maintenance/cleanup-expired-activity-details";
      payload = {};
      break;
    case "cleanup-deleted-activities":
      backendPath = "/maintenance/cleanup-deleted-activities";
      payload = { cutoff_days: 1 };
      break;
    case "apply-subscriptions":
      backendPath = "/maintenance/app-subscriptions/apply-due";
      break;
    case "account-hard-delete":
      backendPath = "/maintenance/account-hard-delete";
      payload = { dry_run: false, only_user_id: null };
      break;
    case "daily-plan-completion":
      backendPath = "/maintenance/coach-plan-complete-due";
      break;

    case "check-ai-models":
      backendPath = "/scheduled-events/check-ai-models";
      // Sem napíš e-mail, ktorý máš v databáze ako Admin
      payload = { admin_email: "patrikmbontar@gmail.com" }; 
      break;

      // NOVÉ: Force Logout Logic
    case "force-logout-all":
      // Tu nevoláme backend, ale priamo Supabase cez Cron Mastera
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
      
      // Načítame staré nastavenia a pridáme timestamp odhlásenia
      const { data: current } = await supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_mode").single();
      const updatedValue = { ...current?.value, force_logout_at: new Date().toISOString() };
      
      await supabaseAdmin.from("app_settings").update({ value: updatedValue }).eq("key", "maintenance_mode");
      return NextResponse.json({ success: true, message: "Signal for global logout sent." });

    default:
      return NextResponse.json({ success: false, error: `Neznáma úloha: ${task}` }, { status: 400 });
  }

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MAINTENANCE_API_KEY as string, 
      },
    };

    if (payload !== undefined) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(`${API_URL}${backendPath}`, fetchOptions);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`Backend Error: ${response.status} - ${JSON.stringify(result)}`);
    }

    return NextResponse.json({ success: true, task, backend_response: result });

  } catch (error: any) {
    console.error(`[Cron Master] Chyba pri úlohe ${task}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}