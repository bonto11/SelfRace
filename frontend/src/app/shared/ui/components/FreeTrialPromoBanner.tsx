// src/app/shared/ui/components/FreeTrialPromoBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

const DISMISS_KEY = "sr_promo_banner_dismissed_v1";

/**
 * Promo banner na landing page: "prvý mesiac zadarmo, bez háčika".
 *
 * Zobrazuje sa LEN v bežnom prehliadači alebo in-app browseri (Instagram,
 * Messenger a pod.) - nie keď appku niekto otvorí ako nainštalovanú PWA
 * (spustenú z ikony na ploche). To zisťujeme cez display-mode: standalone
 * (Android/desktop) a navigator.standalone (staršie iOS Safari) - ak je
 * hocktoré true, appku user už nainštaloval a spúšťa ju ako appku, takže
 * banner na "vyskúšaj zadarmo" pre neho nemá zmysel.
 *
 * Zavretie (X) sa pamätá v localStorage, aby sa banner nevracal pri každej
 * návšteve tej istej osoby v tom istom prehliadači.
 */
export default function FreeTrialPromoBanner() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* localStorage nedostupný (napr. private mode) - banner radšej ukážeme */
    }

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any).standalone === true;

    if (!isStandalone) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2147483000, background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl px-6 py-7 text-center backdrop-blur-xl"
        style={{
          background: appColors.surfaceCard,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          boxShadow: appColors.shadowCard,
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.cancel")}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-lg opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: appColors.buttonGhostBg, color: appColors.textPrimary }}
        >
          ×
        </button>

        <div
          className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4"
          style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
        >
          {t("landing.promo.badge")}
        </div>

        <h2 className="text-2xl font-bold tracking-tight mb-2">
          {t("landing.promo.title")}
        </h2>

        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: appColors.textSecondary }}
        >
          {t("landing.promo.body")}
        </p>

        <Link
          href="/signup"
          onClick={dismiss}
          className="inline-flex items-center justify-center w-full px-6 py-3 rounded-full text-sm font-semibold transition-colors"
          style={{
            background: appColors.buttonPrimaryBg,
            color: appColors.buttonPrimaryText,
            border: `1px solid ${appColors.surfaceCardBorder}`,
          }}
        >
          {t("landing.promo.cta")}
        </Link>
      </div>
    </div>,
    document.body,
  );
}
