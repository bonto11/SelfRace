// src/components/PwaInstallBanner.tsx
"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import { useT } from "@/app/shared/i18n/useT";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

type Props = {
  userId: number | null;
};

export default function PwaInstallBanner({ userId }: Props) {
  const t = useT();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (!userId || userId === 0) return;

    let alive = true;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const checkAndShow = async () => {
      try {
        const currentSettings =
          (await apiFetchUserPref(userId, "user.settings")) || {};

        if (!currentSettings.onboarding_seen) return;
        if (currentSettings.pwa_prompt_dismissed) return;

        setTimeout(() => {
          if (alive) setShowPrompt(true);
        }, 6000);
      } catch (e) {
        console.error("Nepodarilo sa skontrolovať PWA status", e);
      }
    };

    checkAndShow();

    return () => {
      alive = false;
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, [userId]);

  const markAsDismissed = async () => {
    setShowPrompt(false);
    if (!userId) return;
    try {
      const currentSettings =
        (await apiFetchUserPref(userId, "user.settings")) || {};
      const updatedSettings = {
        ...currentSettings,
        pwa_prompt_dismissed: true,
      };
      await apiUpsertUserPref(userId, "user.settings", updatedSettings);
    } catch (e) {
      console.error("Nepodarilo sa uložiť status pwa_prompt_dismissed", e);
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      markAsDismissed();
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    markAsDismissed();
  };

  if (!showPrompt || (!isIos && !deferredPrompt)) return null;

  // Dynamická zložka podľa jazyka (fallback na images_sk)
  const imgFolder = t("pwaPrompt.imgFolder") as string;

  const iosSteps = [
    {
      text: t("pwaPrompt.step1") as string,
      img: `/pwa_tutorial/${imgFolder}/step1.png`,
    },
    {
      text: t("pwaPrompt.step2") as string,
      img: `/pwa_tutorial/${imgFolder}/step2.jpg`,
    },
    {
      text: t("pwaPrompt.step3") as string,
      img: `/pwa_tutorial/${imgFolder}/step3.png`,
    },
    {
      text: t("pwaPrompt.step4") as string,
      img: `/pwa_tutorial/${imgFolder}/step4.png`,
    },
  ];

  return (
    <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        className="w-full max-w-sm bg-base-100 rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col transform transition-all max-h-[90vh]"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl mb-4 shrink-0"
          style={{
            backgroundColor: `${appColors.brandPrimary}20`,
            color: appColors.brandPrimary,
          }}
        >
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white mb-4 shrink-0">
          {t("pwaPrompt.title") as string}
        </h3>

        {!isIos && (
          <>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">
              {t("pwaPrompt.androidDesc") as string}
            </p>
            <div className="flex gap-3 justify-end mt-auto shrink-0">
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="btn-sm text-gray-400"
              >
                {t("pwaPrompt.later") as string}
              </Button>
              <Button
                onClick={handleInstall}
                variant="primary"
                className="btn-sm"
              >
                {t("pwaPrompt.install") as string}
              </Button>
            </div>
          </>
        )}

        {isIos && (
          <div className="flex flex-col min-h-0">
            {/* Carousel kontajner - pridaná flex-1 pre prispôsobenie výške */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 mb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-h-0">
              {iosSteps.map((step, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[88%] snap-center flex flex-col bg-white/5 border border-white/10 rounded-xl p-3 h-full"
                >
                  <div className="flex items-start gap-2 mb-3 shrink-0">
                    <span className="shrink-0 font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5 text-white/90">
                      {i + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-medium leading-snug opacity-90 text-white/90 pt-0.5">
                      {step.text}
                    </span>
                  </div>

                  {/* Zväčšený obrázok - h-56 zaručí, že je veľký, ale nerozbije malé iPhony */}
                  <div className="w-full flex-1 bg-black/50 rounded-lg flex items-center justify-center p-2 overflow-hidden shadow-inner min-h-[220px]">
                    <img
                      src={step.img}
                      alt={`Krok ${i + 1}`}
                      className="h-full w-auto object-contain rounded-md"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end mt-2 shrink-0">
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="btn-sm w-full border border-white/20 text-white/70 hover:bg-white/10"
              >
                {t("pwaPrompt.close") as string}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
