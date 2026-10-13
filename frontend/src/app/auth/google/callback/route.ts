// src/app/auth/google/callback/route.ts
//
// Návrat z Google pri prihlásení cez našu doménu (viď ../route.ts):
// overí state, vymení kód za ID token priamo u Google a prihlási usera do
// Supabase cez signInWithIdToken. Nový user = rovnaký DB trigger ako vždy,
// existujúci e-mail Supabase spojí s jeho účtom.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseForRedirect } from "../../redirectClient";
import { GOOGLE_STATE_COOKIE, googleRedirectUri } from "../oauth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  const fail = (why: string) => {
    console.error("[auth/google/callback]", why);
    const r = NextResponse.redirect(new URL("/signin?oauth=error", origin));
    r.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
    return r;
  };

  // zrušený výber účtu na Google príde ako ?error=access_denied
  if (searchParams.get("error")) return fail(`google error ${searchParams.get("error")}`);
  if (!code || !state || !expected || state !== expected) return fail("missing code or state mismatch");

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("google client not configured");

  let idToken: string | undefined;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(origin),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return fail(`token exchange ${res.status} ${json?.error ?? ""}`);
    idToken = json?.id_token;
  } catch (e: any) {
    return fail(`token exchange failed ${e?.message ?? e}`);
  }
  if (!idToken) return fail("no id_token");

  const response = NextResponse.redirect(new URL("/dashboard", origin));
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
  const supabase = supabaseForRedirect(request, response);

  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) return fail(`signInWithIdToken ${error.message}`);
  return response;
}
