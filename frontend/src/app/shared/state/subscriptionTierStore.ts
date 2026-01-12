"use client";

type Listener = (tier: string) => void;

let currentTier = "free";
const listeners = new Set<Listener>();
const STORAGE_KEY = "selfrace.app_subscription_tier";

function loadFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) currentTier = stored;
  } catch {
    /* ignore */
  }
}

// inicializácia na klientovi
if (typeof window !== "undefined") {
  loadFromStorage();
}

export function getSubscriptionTier(): string {
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

  listeners.forEach((fn) => fn(currentTier));
}

export function subscribeSubscriptionTier(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}