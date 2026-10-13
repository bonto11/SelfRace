// src/app/auth/google/route.ts
//
// Prihlásenie cez Google s návratom na našu doménu (selfrace.com).
// PREČO nie priamo Supabase OAuth: Google tam vracia na <projekt>.supabase.co
// a na súhlasovej obrazovke aj v e-maile od Google sa ukazuje táto doména.
// Tu Google vráti kód na /auth/google/callback, server ho vymení za ID token
// a Supabase z neho spraví session (signInWithIdToken) – user ostáva ten istý.
//
// Zapína sa env NEXT_PUBLIC_GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (Vercel);
// bez nich tlačidlo používa pôvodný Supabase flow (/auth/callback).

import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleRedirectUri } from "./oauth";

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/signin?oauth=error", origin));
  }

  // state chráni callback pred podstrčeným kódom (CSRF) – porovná sa s cookie
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // výber účtu aj pri jednom prihlásenom Google účte (zdieľané zariadenia)
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return response;
}
