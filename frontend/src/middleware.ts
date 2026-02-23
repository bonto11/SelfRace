// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

export async function middleware(request: NextRequest) {
  // 1. Ignoruj iba Next.js statické súbory a obrázky
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  // 2. Klient na čítanie a bezpečné zapisovanie cookies pre obnovu session
  const supabase = createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Spustením getUser() dáš Supabase pokyn, aby skontroloval, či nevypršal token. 
  // Ak áno, ticho ho obnoví pomocou funkcie setAll.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/:path*"],
};