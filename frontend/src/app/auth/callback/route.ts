// src/app/auth/callback/route.ts
//
// Návrat z prihlásenia cez Google (Supabase OAuth, PKCE): vymení `code` za
// session a uloží ju do cookies, potom pošle usera do appky.
// Riadok v `users` založí DB trigger na auth.users rovnako ako pri e-maile;
// rovnaký e-mail ako existujúci účet Supabase spojí do jedného usera.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = NextResponse.redirect(new URL("/signin?oauth=error", origin));

  // zrušený súhlas na Google alebo chyba providera príde ako ?error=…
  if (!code || searchParams.get("error")) return failed;

  const response = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = createServerClient(
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
    return failed;
  }
  return response;
}
