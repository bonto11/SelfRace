import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let serverMessage = "N/A";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 31536000,
        path: '/',
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) => {
            // 🛑 ABSOLÚTNY ZÁKAZ MAZANIA COOKIES PRE SERVER
            if (!value || value === "") {
               console.warn(`[SERVER SPY] ZABLOKOVAL SOM SERVERU POKUS ZMAZAŤ COOKIE: ${name}`);
               return; // Koniec. Nedovolíme mu to aplikovať do prehliadača.
            } 
            
            // Ak je token platný, predĺžime mu život na 1 rok
            supabaseResponse.cookies.set(name, value, { ...options, maxAge: 31536000 });
          });
        },
      },
    }
  );

  // 🛑 ÚMYSELNE VYPNUTÉ: Aby sme zistili, či to bola táto funkcia, ktorá to ničila
  // const { data, error } = await supabase.auth.getUser();

  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent("Overovanie na serveri je DOČASNE VYPNUTÉ"));
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};