"use client";

/*
 * Perzistentná cache dát pre data providery (localStorage).
 *
 * PREČO localStorage a nie sessionStorage: na iOS/Android PWA sa
 * sessionStorage po vyswajpovaní appky zmaže, takže každé otvorenie bolo
 * "studené" a všetky widgety čakali na BE. Z localStorage sa posledné dáta
 * ukážu hneď a čerstvé sa doťahujú na pozadí.
 *
 * Kľúče vždy obsahujú userId. Odhlásenie (signOut) maže celý localStorage,
 * takže dáta neostanú ďalšiemu userovi na zariadení. Auth session je v
 * cookies - táto cache sa jej nijako nedotýka.
 */

const PREFIX = "sr:cache:v1:";

type Entry<T> = { at: number; data: T };

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function cacheRead<T>(key: string): { data: T; at: number } | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return { data: parsed.data, at: Number(parsed.at) || 0 };
  } catch {
    return null;
  }
}

/** Zmaže všetky položky tejto cache (nie iné kľúče v localStorage). */
export function cacheClearAll() {
  const ls = storage();
  if (!ls) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function cacheWrite<T>(key: string, data: T) {
  const ls = storage();
  if (!ls) return;
  const payload = JSON.stringify({ at: Date.now(), data } satisfies Entry<T>);
  try {
    ls.setItem(PREFIX + key, payload);
  } catch {
    // plný localStorage - zahodíme len vlastnú cache a skúsime raz znova.
    // Ostatné kľúče (auth, nastavenia) nechávame tak.
    cacheClearAll();
    try {
      ls.setItem(PREFIX + key, payload);
    } catch {
      /* ignore */
    }
  }
}
