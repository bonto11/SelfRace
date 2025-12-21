"use client";

import { apiUpsertUserPref } from "@/features/prefs/api/prefs";

const KEY = "pb.favorite_run_m"; // kľúč v DB
const LS = `up:${KEY}`; // kľúč v localStorage

export function getFavPBRunFromLS(): number | null {
  try {
    const raw = localStorage.getItem(LS);
    if (raw == null) return null;
    const v = JSON.parse(raw);
    return Number.isFinite(Number(v)) ? Number(v) : null;
  } catch {
    return null;
  }
}

export function setFavPBRunLS(m: number | null) {
  try {
    localStorage.setItem(LS, JSON.stringify(m));
  } catch {}
}

/** Optimisticky uloží do LS a následne do DB. */
export async function setFavPBRunDB(
  userId: number | null | undefined,
  m: number | null
) {
  setFavPBRunLS(m);
  if (!userId) return;
  try {
    await apiUpsertUserPref(userId, KEY, m);
  } catch {
    /* ticho */
  }
}
