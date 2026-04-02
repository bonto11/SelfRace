import { NextResponse } from 'next/server';
import { API_URL, CRON_SECRET, MAINTENANCE_API_KEY } from "@/app/shared/config";

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
  let payload: any = null;

  // 🚀 2. Inteligentný Smerovač (Router)
  // Sem si budeš dopĺňať nové úlohy (aj tie týždenné)
  switch (task) {
    case "recovery":
      backendPath = "/notifications-timed/recovery";
      break;
    case "review":
      backendPath = "/notifications-timed/review";
      break;
    case "training":
      backendPath = "/notifications-timed/training";
      break;
    case "weekly-summary": // Príklad týždennej úlohy
      backendPath = "/notifications-timed/weekly-report";
      break;
    case "hourly-ping":
      backendPath = "/notifications-timed/global";
      // Dynamický výpočet času pre globálny ping
      const now = new Date();
      const baHour = new Intl.DateTimeFormat('sk-SK', { timeZone: 'Europe/Bratislava', hour: '2-digit', hour12: false }).format(now).padStart(2, '0');
      const scheduledTime = `${baHour}:00`;
      
      payload = {
        messages: {
          sk: { title: `Hodinový report (${scheduledTime}) ⏱️`, body: `PWA Heartbeat: Slot ${scheduledTime} v poriadku.`, url: "/activities" },
          en: { title: `Hourly Report (${scheduledTime}) ⏱️`, body: `PWA Heartbeat: Slot ${scheduledTime} okay.`, url: "/activities" }
        }
      };
      break;
    default:
      return NextResponse.json({ success: false, error: `Neznáma úloha: ${task}` }, { status: 400 });
  }

  try {
    // 🔗 3. Volanie Python Backend-u (Next.js -> Python)
    const response = await fetch(`${API_URL}${backendPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MAINTENANCE_API_KEY as string, 
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Backend Error: ${JSON.stringify(result)}`);
    }

    return NextResponse.json({ success: true, task, backend_response: result });

  } catch (error: any) {
    console.error(`[Cron Master] Chyba pri úlohe ${task}:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}