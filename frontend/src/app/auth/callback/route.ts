// src/app/auth/callback/route.ts
//
// Návrat z prihlásenia cez Google (Supabase OAuth, PKCE): vymení `code` za
// session a uloží ju do cookies, potom pošle usera do appky.
// Riadok v `users` založí DB trigger na auth.users rovnako ako pri e-maile;
// rovnaký e-mail ako existujúci účet Supabase spojí do jedného usera.
// Keď je nastavený vlastný Google klient, ide sa cez /auth/google (viď tam).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseForRedirect } from "../redirectClient";
import { markNewSignup } from "../newSignup";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = NextResponse.redirect(new URL("/signin?oauth=error", origin));

  // zrušený súhlas na Google alebo chyba providera príde ako ?error=…
  if (!code || searchParams.get("error")) return failed;

  const response = NextResponse.redirect(new URL("/dashboard", origin));
  const supabase = supabaseForRedirect(request, response);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
    return failed;
  }
  markNewSignup(response, origin, data.user?.created_at);
  return response;
}
