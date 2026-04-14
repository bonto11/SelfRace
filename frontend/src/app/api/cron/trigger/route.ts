import { NextResponse } from "next/server";
import { API_URL, CRON_SECRET } from "@/app/shared/config";

// 👇 IMPORTUJEME TVOJ SAMOSTATNÝ SÚBOR S TEXTAMI
import { manualGlobalPayload } from "./global-payload";

export async function POST(request: Request) {
  // 🛡️ Ochrana
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const task = searchParams.get("task");

  if (!task) {
    return NextResponse.json(
      { success: false, error: "Chýba parameter 'task'" },
      { status: 400 },
    );
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
    // --- 2. MANUÁLNE GLOBÁLNE OZNÁMENIA (Nové features) ---
    case "global-manual":
      backendPath = "/notifications/global";
      // Ak si poslal texty v requeste (cez Admin Panel), použi ich.
      // Inak zober tie, čo sú napevno napísané v súbore global-payload.ts.
      payload = requestBody || manualGlobalPayload;
      break;

    // NOVÉ: Force Logout Logic
    case "force-logout-all":
      // Tu nevoláme backend, ale priamo Supabase cez Cron Mastera
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE!,
      );

      // Načítame staré nastavenia a pridáme timestamp odhlásenia
      const { data: current } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      const updatedValue = {
        ...current?.value,
        force_logout_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from("app_settings")
        .update({ value: updatedValue })
        .eq("key", "maintenance_mode");
      return NextResponse.json({
        success: true,
        message: "Signal for global logout sent.",
      });

    default:
      return NextResponse.json(
        { success: false, error: `Neznáma úloha: ${task}` },
        { status: 400 },
      );
  }

  try {
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.MAINTENANCE_API_KEY as string,
      },
    };

    if (payload !== undefined) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(`${API_URL}${backendPath}`, fetchOptions);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Backend Error: ${response.status} - ${JSON.stringify(result)}`,
      );
    }

    return NextResponse.json({ success: true, task, backend_response: result });
  } catch (error: any) {
    console.error(`[Cron Master] Chyba pri úlohe ${task}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
