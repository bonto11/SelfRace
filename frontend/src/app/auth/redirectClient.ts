// src/app/auth/redirectClient.ts
//
// Supabase klient pre auth route, ktorá končí presmerovaním: session cookies
// zapisuje priamo do odpovede (redirect), ktorú route vráti.

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export function supabaseForRedirect(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // rovnako ako middleware: session cookie na rok (iOS PWA inak odhlasovala)
            if (name.includes("auth-token") && !name.includes("verifier")) {
              response.cookies.set(name, value, { ...options, maxAge: 31536000 });
            } else {
              response.cookies.set(name, value, options);
            }
          });
        },
      },
    },
  );
}
