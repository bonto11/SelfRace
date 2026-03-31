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
        name: 'sr-token', // 🚀 Musí sedieť s prehliadačom
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
            // 🛡️ OCHRANNÝ ŠTÍT: Ak ju chce zmazať, zablokujeme to
            if (!value || value === "") {
               console.warn(`[SERVER SPY] Zablokované zmazanie cookie: ${name}`);
               return; 
            }
            supabaseResponse.cookies.set(name, value, { ...options, maxAge: 31536000 });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
     serverMessage = `CHYBA: ${error.message}`;
  } else {
     serverMessage = `OK: User ${data?.user?.id}`;
  }

  // 🕵️ Zápis do HTTP hlavičiek pre tvoju kontrolu v F12
  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent(serverMessage));

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};