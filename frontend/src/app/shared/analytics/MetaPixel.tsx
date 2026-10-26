// src/app/shared/analytics/MetaPixel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  CONSENT_EVENT,
  flushPendingRegistration,
  getConsent,
  loadPixel,
  pixelEnabled,
  setConsent,
  trackPageView,
  trackRegistration,
  type ConsentState,
} from "./metaPixel";

// Návrat z Google registrácie: callback pridá ?reg=google (nový účet), tu sa odošle
// a parameter sa z URL zmaže, aby ho reload neposlal druhýkrát.
function takeRegParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reg") !== "google") return;
    url.searchParams.delete("reg");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    trackRegistration("google");
  } catch {}
}

/**
 * Meta Pixel + lišta so súhlasom. Bez NEXT_PUBLIC_META_PIXEL_ID nerobí nič.
 * Odmietnuť je rovnako veľké ako súhlasiť (GDPR – súhlas musí byť slobodný).
 */
export default function MetaPixel() {
  const t = useT();
  const pathname = usePathname();
  const [consent, setConsentState] = useState<ConsentState | "unknown">("unknown");
  const firstPath = useRef(true);

  useEffect(() => {
    if (!pixelEnabled()) return;
    const sync = () => {
      const c = getConsent();
      setConsentState(c);
      if (c === "granted") {
        loadPixel();
        flushPendingRegistration();
      }
    };
    sync();
    takeRegParam();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  // PageView pri prechode medzi stránkami (prvý odošle loadPixel)
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    trackPageView();
  }, [pathname]);

  if (!pixelEnabled() || consent !== null) return null;

  const btn = "flex-1 px-4 py-2.5 rounded-full text-sm font-semibold";
  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed left-0 right-0 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)", zIndex: 999990 }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-4"
        style={{
          background: appColors.surfaceSolid,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          boxShadow: appColors.shadowCard,
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
          {t("cookieConsent.text")}{" "}
          <Link href="/privacy" className="underline" style={{ color: appColors.textPrimary }}>
            {t("cookieConsent.more")}
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={btn}
            onClick={() => setConsent("denied")}
            style={{
              background: appColors.buttonGhostBg,
              color: appColors.textPrimary,
              border: `1px solid ${appColors.surfaceCardBorder}`,
            }}
          >
            {t("cookieConsent.reject")}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setConsent("granted")}
            style={{ background: appColors.buttonPrimaryBg, color: appColors.buttonPrimaryText }}
          >
            {t("cookieConsent.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
