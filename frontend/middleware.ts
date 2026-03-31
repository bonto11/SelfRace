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
        name: 'sr-token', // 🚀 Rovnaký krátky názov ako v prehliadači
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
            // STÁLE BLOKUJEME SERVER PRED MAZANÍM
            if (!value || value === "") return; 
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

  // 🕵️ Vložíme správu zo servera do hlavičiek, aby si ju videl v prehliadači
  supabaseResponse.headers.set('X-Server-Debug-Status', encodeURIComponent(serverMessage));

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};