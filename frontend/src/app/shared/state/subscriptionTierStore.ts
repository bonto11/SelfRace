// src/app/shared/state/subscriptionTierStore.ts
"use client";

type Listener = (tier: string) => void;

let currentTier = "free";
const listeners = new Set<Listener>();
export const STORAGE_KEY = "selfrace.app_subscription_tier";

// Bezpečná funkcia na získanie dát - nevolá sa automaticky pri SSR!
export function getSubscriptionTier(): string {
  if (typeof window === "undefined") {
    return "free"; // Fallback pre server
  }
  
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentTier = stored;
      return stored;
    }
  } catch {
    /* ignore */
  }
  
  return currentTier;
}

export function setSubscriptionTier(tier: string) {
  currentTier = tier || "free";

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, currentTier);
    }
  } catch {
    /* ignore */
  }

  // Notifikujeme všetky komponenty, ktoré počúvajú
  listeners.forEach((fn) => fn(currentTier));
}

export function subscribeSubscriptionTier(listener: Listener): () => void {
  listeners.add(listener);
  // Hneď po registrácii pošleme aktuálny stav
  listener(getSubscriptionTier());
  
  return () => {
    listeners.delete(listener);
  };
}

// ✅ Pridáme funkciu pre bezpečné vymazanie (použijeme pri odhlásení)
export function clearSubscriptionTier() {
  currentTier = "free";
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
     /* ignore */
  }
  listeners.forEach((fn) => fn("free"));
}