import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 🕵️ SERVER DETEKTÍV 1: Čo chce server urobiť s cookies?
          console.log("\n[SERVER DETEKTÍV] Supabase upravuje cookies:", JSON.stringify(cookiesToSet));

          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value || value === "") {
               console.log(`[SERVER DETEKTÍV] 🛑 SMRTEĽNÝ PRÍKAZ: Server posiela do prehliadača príkaz ZMAZAŤ cookie: ${name}`);
            }
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 🕵️ SERVER DETEKTÍV 2: Zistíme presný dôvod zlyhania
  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
     console.error("[SERVER DETEKTÍV] ❌ getUser() ZLYHAL PRI REFERSHI! Dôvod:", error.message);
  } else {
     console.log("[SERVER DETEKTÍV] ✅ getUser() je úspešný. User ID:", data?.user?.id);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};