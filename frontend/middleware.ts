import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'selfrace-token', // 🚀 NUKLEÁRNE RIEŠENIE: Úplne nový názov cookie
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
            // 🛡️ OCHRANNÝ ŠTÍT + DETEKTÍV
            if (!value || value === "") {
              console.warn(`[Middleware Detektív] 🛡️ Zablokovaný pokus o zmazanie cookie: ${name}`);
              return; 
            }
            supabaseResponse.cookies.set(name, value, { 
                ...options, 
                maxAge: 31536000 
            });
          });
        },
      },
    }
  );

  // Znovu sme ZAPLI overovanie používateľa, nech server plní svoju funkciu
  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.warn("[Middleware Detektív] Chyba pri overovaní používateľa:", err);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};