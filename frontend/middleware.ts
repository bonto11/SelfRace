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
            // 1. PWA ZÁCHRANA (Session Fix)
            // Dáme 1 rok života IBA platnému tokenu, aby ho iOS nezmazal po swajpe.
            if (name.includes('auth-token') && !name.includes('verifier')) {
              supabaseResponse.cookies.set(name, value, { ...options, maxAge: 31536000 });
            } else {
              supabaseResponse.cookies.set(name, value, options);
            }
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

  // 2. TVOJA POISTKA (Server-side Teleport)
  const path = request.nextUrl.pathname;
  // Ak sa snaží načítať Landing Page alebo Prihlásenie a my vieme, že je prihlásený...
  if ((path === '/' || path === '/signin' || path === '/signup') && data?.user) {
      // Okamžite ho teleportujeme do aplikácie, aby nevidel prebliknutie!
      const redirectUrl = new URL('/activities', request.url);
      return NextResponse.redirect(redirectUrl);
  }

  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent(serverMessage));
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};