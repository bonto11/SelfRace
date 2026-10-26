// src/app/auth/newSignup.ts
//
// Nový účet cez Google: presmerovanie dostane ?reg=google, FE (MetaPixel) z neho
// odošle registráciu do Meta Pixelu. PREČO podľa created_at: Google registrácia aj
// prihlásenie idú tou istou cestou a iný signál, že účet práve vznikol, nemáme.

import type { NextResponse } from "next/server";

const NEW_ACCOUNT_MS = 10 * 60 * 1000;

export function markNewSignup(response: NextResponse, origin: string, createdAt?: string) {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(created) || Date.now() - created > NEW_ACCOUNT_MS) return;
  const url = new URL(response.headers.get("location") || "/dashboard", origin);
  url.searchParams.set("reg", "google");
  response.headers.set("location", url.toString());
}
