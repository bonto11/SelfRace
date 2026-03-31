import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let serverMessage = "N/A";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) => {
            // 🕵️ INTELIGENTNÉ PRAVIDLO: 
            // Ak je hodnota prázdna, alebo Supabase žiada o zmazanie (maxAge <= 0), nesmieme to blokovať!
            if (!value || value === "" || (options && options.maxAge !== undefined && options.maxAge <= 0)) {
               console.log(`[SERVER SPY] Upratal som nepotrebnú cookie: ${name}`);
               supabaseResponse.cookies.set(name, value, options); 
            } else {
               // Až tu, ak sú to platné dáta, chránime PWA tým, že im dáme 1 rok
               supabaseResponse.cookies.set(name, value, { ...options, maxAge: 31536000 });
            }
          });
        },
      },
    }
  );

  // ZAPNUTÉ OVEROVANIE (Teraz už bude úspešné)
  const { data, error } = await supabase.auth.getUser();
  if (error) {
     serverMessage = `CHYBA: ${error.message}`;
  } else {
     serverMessage = `OK: User ${data?.user?.id}`;
  }

  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent(serverMessage));
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};