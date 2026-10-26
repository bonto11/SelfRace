// src/app/shared/analytics/metaPixel.ts
//
// Meta Pixel – meranie návštev a registrácií z reklám na Instagrame/Facebooku.
// PREČO až po súhlase: Pixel ukladá marketingové cookies, tie smú ísť (GDPR/ePrivacy)
// len so súhlasom. Kým user nerozhodne, nenačíta sa nič a registrácia sa len
// zapamätá v sessionStorage – odošle sa, keď súhlas dá.
"use client";

import { META_PIXEL_ID } from "@/app/shared/config";

export type ConsentState = "granted" | "denied" | null;

const CONSENT_KEY = "sr:consent:v1";
const PENDING_REG_KEY = "sr:pending-reg";
export const CONSENT_EVENT = "sr:consent-change";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function pixelEnabled(): boolean {
  return !!META_PIXEL_ID;
}

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: ConsentState) {
  try {
    if (v) localStorage.setItem(CONSENT_KEY, v);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {}
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Načíta fbevents.js (raz) a zaznamená PageView. Len so súhlasom. */
export function loadPixel() {
  if (!META_PIXEL_ID || typeof window === "undefined" || window.fbq) return;
  // oficiálny zavádzací kód od Meta, len prepísaný do TS
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);

  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}

export function trackPageView() {
  if (getConsent() === "granted") window.fbq?.("track", "PageView");
}

/** Dokončená registrácia (e-mail alebo Google). Bez rozhodnutia o súhlase sa odloží. */
export function trackRegistration(method: "email" | "google") {
  if (!META_PIXEL_ID) return;
  const consent = getConsent();
  if (consent === "granted") {
    loadPixel();
    window.fbq?.("track", "CompleteRegistration", { method });
    return;
  }
  if (consent === null) {
    try {
      sessionStorage.setItem(PENDING_REG_KEY, method);
    } catch {}
  }
}

/** Po udelení súhlasu odošle registráciu, ktorá prišla skôr. */
export function flushPendingRegistration() {
  try {
    const method = sessionStorage.getItem(PENDING_REG_KEY);
    if (!method) return;
    sessionStorage.removeItem(PENDING_REG_KEY);
    window.fbq?.("track", "CompleteRegistration", { method });
  } catch {}
}
