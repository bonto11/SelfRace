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
          // 1. Nastavíme prichádzajúce cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          supabaseResponse = NextResponse.next({ request });
          
          // 2. Aplikujeme upravené cookies do odpovede
          cookiesToSet.forEach(({ name, value, options }) => {
            // 🛡️ OCHRANNÝ ŠTÍT
            if (!value || value === "") {
              console.warn(`[Middleware] 🛡️ Zablokovaný pokus o zmazanie cookie: ${name}`);
              return; 
            }
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 🛑 SERVEROVÉ OVERENIE ÚMYSELNE VYPNUTÉ PRE TEST!
  // try {
  //   await supabase.auth.getUser();
  // } catch (err) {}

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};