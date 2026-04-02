import { NextResponse } from 'next/server';
import { API_URL, CRON_SECRET } from "@/app/shared/config";

export async function POST(request: Request) {
  // 🛡️ 1. Bezpečnostná kontrola (Google -> Next.js)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Zistíme, ktorú úlohu ideme spustiť
  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task');

  if (!task) {
    return NextResponse.json({ success: false, error: "Chýba parameter 'task'" }, { status: 400 });
  }

  let backendPath = "";
  let payload: any = undefined; 

  // 🚀 2. Inteligentný Smerovač (Router)
  switch (task) {
    // --- NOTIFIKÁCIE ---
    case "recovery":
      backendPath = "/notifications-timed/recovery";
      payload = {};
      break;
    case "review":
      backendPath = "/notifications-timed/review";
      payload = {};
      break;
    case "training":
      backendPath = "/notifications-timed/training";
      payload = {};
      break;
    case "hourly-ping":
      backendPath = "/notifications-timed/global";
      const now = new Date();
      const baHour = new Intl.DateTimeFormat('sk-SK', { timeZone: 'Europe/Bratislava', hour: '2-digit', hour12: false }).format(now).padStart(2, '0');
      const scheduledTime = `${baHour}:00`;
      payload = {
        messages: {
          sk: { title: `Hodinový report (${scheduledTime}) ⏱️`, body: `PWA Heartbeat: Slot ${scheduledTime} OK.`, url: "/activities" },
          en: { title: `Hourly Report (${scheduledTime}) ⏱️`, body: `PWA Heartbeat: Slot ${scheduledTime} OK.`, url: "/activities" }
        }
      };
      break;

    // --- ÚDRŽBA A SYSTÉM ---
    case "weekly-athlete-state":
      backendPath = "/maintenance/weekly-athlete-state-refresh";
      payload = { max_users: 5 };
      break;

    case "daily-plan-completion":
      backendPath = "/maintenance/coach-plan-complete-due";
      break;

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

    default:
      return NextResponse.json({ success: false, error: `Neznáma úloha: ${task}` }, { status: 400 });
  }

  try {
    // 🔗 3. Volanie Python Backend-u
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