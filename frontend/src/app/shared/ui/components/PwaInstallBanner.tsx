// src/components/PwaInstallBanner.tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
  const [activeStep, setActiveStep] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

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

  // Dynamická zložka podľa jazyka
  const imgFolder = t("pwaPrompt.imgFolder") as string;

  // PREČO nové obrázky: iOS 26 má v Safari namiesto troch bodiek ikonu ☰ v adresnom
  // riadku a pri „Pridať na plochu“ prepínač „Otvoriť ako webovú apku“ – bez neho
  // nefungujú notifikácie. Zvýraznenie je priamo v obrázku.
  const iosSteps = (
    ["pwaPrompt.step1", "pwaPrompt.step2", "pwaPrompt.step3", "pwaPrompt.step4"] as const
  ).map((key, i) => ({
    text: t(key) as string,
    img: `/${imgFolder}/pwa_tutorial/step${i + 1}.webp`,
  }));
  const lastStep = iosSteps.length - 1;

  const goToStep = (i: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== activeStep) setActiveStep(Math.max(0, Math.min(lastStep, i)));
  };

  return (
    <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        className="relative w-full max-w-sm rounded-3xl p-5 sm:p-6 flex flex-col max-h-[92dvh] overflow-hidden"
        style={{
          background: appColors.surfaceSolid,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          boxShadow: appColors.shadowCard,
        }}
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("pwaPrompt.close") as string}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-lg opacity-70 hover:opacity-100 transition-opacity"
          style={{ background: appColors.buttonSecondaryBg, color: appColors.textPrimary }}
        >
          ×
        </button>

        <div className="flex items-center gap-3 mb-2 shrink-0 pr-8">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
            style={{
              backgroundColor: `${appColors.brandPrimary}20`,
              color: appColors.brandPrimary,
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h3 className="text-lg sm:text-xl font-bold" style={{ color: appColors.textPrimary }}>
            {t("pwaPrompt.title") as string}
          </h3>
        </div>

        <p className="text-sm leading-relaxed mb-4 shrink-0" style={{ color: appColors.textSecondary }}>
          {(isIos ? t("pwaPrompt.iosDesc") : t("pwaPrompt.androidDesc")) as string}
        </p>

        {!isIos && (
          <div className="flex gap-3 justify-end mt-auto shrink-0">
            <Button onClick={handleDismiss} variant="ghost" size="sm">
              {t("pwaPrompt.later") as string}
            </Button>
            <Button onClick={handleInstall} variant="primary" size="sm">
              {t("pwaPrompt.install") as string}
            </Button>
          </div>
        )}

        {isIos && (
          <div className="flex flex-col min-h-0">
            <div
              ref={carouselRef}
              onScroll={onCarouselScroll}
              className="flex overflow-x-auto snap-x snap-mandatory min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {iosSteps.map((step, i) => (
                <div key={i} className="shrink-0 w-full snap-center flex flex-col gap-3 px-0.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-sm font-medium leading-snug pt-0.5"
                      style={{ color: appColors.textPrimary }}
                    >
                      {step.text}
                    </span>
                  </div>

                  <div
                    className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                    style={{
                      background: appColors.backgroundMain,
                      border: `1px solid ${appColors.surfaceCardBorder}`,
                    }}
                  >
                    <img
                      src={step.img}
                      alt={`${t("pwaPrompt.stepAlt") as string} ${i + 1}`}
                      className="w-full h-auto max-h-[38dvh] object-contain"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-1.5 mt-4 shrink-0" aria-hidden="true">
              {iosSteps.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === activeStep ? 20 : 6,
                    background: i === activeStep ? appColors.brandPrimary : appColors.surfaceCardBorder,
                  }}
                />
              ))}
            </div>

            {activeStep === lastStep && (
              <p
                className="text-xs leading-relaxed mt-3 rounded-xl px-3 py-2 shrink-0"
                style={{ color: appColors.textPrimary, background: `${appColors.brandPrimary}14` }}
              >
                {t("pwaPrompt.after") as string}
              </p>
            )}

            <div className="flex gap-3 mt-4 shrink-0">
              {activeStep > 0 && (
                <Button variant="secondary" size="sm" onClick={() => goToStep(activeStep - 1)}>
                  {t("pwaPrompt.back") as string}
                </Button>
              )}
              {activeStep < lastStep ? (
                <Button variant="primary" size="sm" block onClick={() => goToStep(activeStep + 1)}>
                  {t("pwaPrompt.next") as string}
                </Button>
              ) : (
                <Button variant="primary" size="sm" block onClick={handleDismiss}>
                  {t("pwaPrompt.close") as string}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
