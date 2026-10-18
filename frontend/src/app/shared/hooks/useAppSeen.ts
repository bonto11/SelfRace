// src/app/shared/hooks/useAppSeen.ts
"use client";

import { useEffect } from "react";
import { callBackend } from "@/app/shared/utils/callBackend";

// Záznam „user otvoril appku“ (users_preferences app.seen) pre admin prehľad:
// kedy naposledy, či z plochy (PWA) a na akom zariadení.
// PREČO throttle: PWA ostáva v pamäti dni – zapisuje sa pri štarte a pri návrate
// do appky, najviac raz za SEEN_EVERY_MS (zmena PWA/prehliadač zapíše hneď).
const SEEN_EVERY_MS = 3 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function platform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent || "";
  // iPadOS sa hlási ako Mac – prezradí ho dotyková obrazovka
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function markSeen(userId: number) {
  const standalone = isStandalone();
  const key = `sr:seen:v1:${userId}`;
  try {
    const prev = JSON.parse(window.localStorage.getItem(key) || "null");
    if (prev && Date.now() - Number(prev.t) < SEEN_EVERY_MS && prev.s === standalone) return;
  } catch {
    /* bez localStorage zapíšeme vždy */
  }
  void callBackend(
    `/users/${userId}/seen`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standalone, platform: platform() }),
    },
    { silent: true },
  )
    .then(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ t: Date.now(), s: standalone }));
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      /* vedľajšia vec – appku nesmie rušiť */
    });
}

/** Vlastný účet (ownUserId), nie prezeraný zverenec. */
export function useAppSeen(userId: number | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    markSeen(userId);
    const onVisible = () => {
      if (document.visibilityState === "visible") markSeen(userId);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);
}
