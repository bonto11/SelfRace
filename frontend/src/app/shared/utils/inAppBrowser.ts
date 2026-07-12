// src/app/shared/utils/inAppBrowser.ts
"use client";

export type InAppBrowserInfo = {
  isInApp: boolean;
  appName: string | null; // "Instagram" | "Messenger" | "Facebook" | "TikTok" | "LinkedIn" | ...
  isIOS: boolean;
  isAndroid: boolean;
};

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === "undefined") {
    return { isInApp: false, appName: null, isIOS: false, isAndroid: false };
  }

  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  let appName: string | null = null;

  if (/Instagram/i.test(ua)) appName = "Instagram";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) appName = "Facebook";
  else if (/Messenger/i.test(ua)) appName = "Messenger";
  else if (/Twitter/i.test(ua)) appName = "X (Twitter)";
  else if (/TikTok|musical_ly/i.test(ua)) appName = "TikTok";
  else if (/LinkedInApp/i.test(ua)) appName = "LinkedIn";
  else if (/Snapchat/i.test(ua)) appName = "Snapchat";
  else if (/Line\//i.test(ua)) appName = "LINE";
  else if (/GSA\//i.test(ua) && isIOS) appName = "Google App"; // Google app na iOS má tiež webview

  return { isInApp: !!appName, appName, isIOS, isAndroid };
}

/**
 * Android: pokus o priame presmerovanie do systémového Chrome cez intent:// scheme.
 * Toto funguje spoľahlivo pre väčšinu in-app browserov na Androide (FB, IG, atď.)
 * a otvorí stránku v Chrome bez akéhokoľvek dialógu pre používateľa.
 */
export function tryAndroidIntentRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const { isAndroid, isInApp } = detectInAppBrowser();
  if (!isAndroid || !isInApp) return false;

  const url = window.location.href;
  const withoutScheme = url.replace(/^https?:\/\//, "");
  const intentUrl = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;

  try {
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
}
