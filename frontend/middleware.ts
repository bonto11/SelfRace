import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 1. ZADEFINUJ SI TAJNÚ URL PRE ADMINA
const SECRET_ADMIN_PATH = '/hq-secure-zone';

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
            // 1. PWA ZÁCHRANA (Session Fix) - PONECHANÉ
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

  const path = request.nextUrl.pathname;

  // --- NOVÁ ČASŤ: KONTROLA REŽIMU ÚDRŽBY ---
  // Musíme predísť zacykleniu, ak už sme na stránke /maintenance
  if (path !== '/maintenance' && !path.startsWith(SECRET_ADMIN_PATH)) {
      // Skontrolujeme stav údržby z databázy (odporúča sa časom pridať Vercel Edge Config pre rýchlosť)
      const { data: settings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();
          
      if (settings?.value?.active) {
          // Ak je zapnutá, presmerujeme všetkých okrem admina (na tajnej ceste) na maintenance obrazovku
          const url = request.nextUrl.clone();
          url.pathname = '/maintenance';
          return NextResponse.redirect(url);
      }
  }
  // -----------------------------------------

  // 2. TVOJA POISTKA (Server-side Teleport) - PONECHANÉ
  // Ak sa snaží načítať Landing Page alebo Prihlásenie a my vieme, že je prihlásený...
  if ((path === '/' || path === '/signin' || path === '/signup') && data?.user) {
      // Okamžite ho teleportujeme do aplikácie, aby nevidel prebliknutie!
      const redirectUrl = new URL('/activities', request.url);
      return NextResponse.redirect(redirectUrl);
  }

  // Pôvodné debugovacie hlavičky - PONECHANÉ
  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent(serverMessage));
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};