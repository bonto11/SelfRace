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
            // 1. PWA ZÁCHRANA (Session Fix)
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
  let isAdminBypassing = false;

  // 🚀 ZMENA: Zadefinujeme prihlasovacie cesty, ktoré nesmú byť nikdy blokované
  const isAuthPath = path === '/signin' || path.startsWith('/auth');

  // --- KONTROLA REŽIMU ÚDRŽBY S VÝNIMKOU PRE ADMINA A PRIHLÁSENIE ---
  if (path !== '/maintenance' && !path.startsWith(SECRET_ADMIN_PATH) && !isAuthPath) {
      const { data: settings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();
          
      if (settings?.value?.active) {
          let isAdmin = false;

          // Ak je zapnutá údržba a niekto je prihlásený, overíme, či to nie je Admin
          if (data?.user) {
              const { data: profile } = await supabase
                  .from('users')
                  .select('role')
                  .eq('auth_uid', data.user.id) // Používame auth_uid
                  .single();

              if (profile?.role === 'ADMIN') {
                  isAdmin = true;
                  isAdminBypassing = true; // Značka, že admin ide do apky
              }
          }

          // Ak údržba beží a používateľ NIE JE admin, presmerujeme ho preč
          if (!isAdmin) {
              const url = request.nextUrl.clone();
              url.pathname = '/maintenance';
              return NextResponse.redirect(url);
          }
      }
  }

  // --- ZÁPIS COOKIE PRE VIZUÁL (AppBackdrop) ---
  if (isAdminBypassing) {
      // Dôležité: httpOnly musí byť false, inak to frontend neprečíta!
      supabaseResponse.cookies.set('admin_maintenance_bypass', 'true', { 
        path: '/', 
        maxAge: 3600, 
        httpOnly: false, 
        sameSite: 'lax' 
      });
  } else {
      supabaseResponse.cookies.delete('admin_maintenance_bypass');
  }
  // -----------------------------------------

  // 2. TVOJA POISTKA (Server-side Teleport)
  if ((path === '/' || path === '/signin') && data?.user) {
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