// src/components/PwaInstallBanner.tsx (alebo kde to máš umiestnené)
"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import { useT } from "@/app/shared/i18n/useT";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

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
        const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
        
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
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [userId]);

  const markAsDismissed = async () => {
    setShowPrompt(false);
    if (!userId) return;
    try {
      const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
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

  // Dáta pre iOS kroky
  const iosSteps = [
    { text: "Klikni na ponuku (3 bodky) v spodnej lište.", img: "/pwa_tutorial/step1.png" },
    { text: "V zozname nájdi a vyber možnosť Zdieľať.", img: "/pwa_tutorial/step2.png" },
    { text: "Potiahni nižšie a zvoľ Pridať na plochu.", img: "/pwa_tutorial/step3.png" },
    { text: "Skontroluj názov apky a klikni na Pridať.", img: "/pwa_tutorial/step4.png" }
  ];

  return (
    <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity">
      <div
        className="w-full max-w-sm bg-base-100 rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col transform transition-all"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${appColors.brandPrimary}20`, color: appColors.brandPrimary }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">
          {t("pwaPrompt.title") as string || "Inštalácia aplikácie"}
        </h3>

        {!isIos && (
          <>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">
              {t("pwaPrompt.androidDesc") as string || "Pridaj si aplikáciu na plochu pre najlepší zážitok z používania."}
            </p>
            <div className="flex gap-3 justify-end mt-auto">
              <Button onClick={handleDismiss} variant="ghost" className="btn-sm text-gray-400">
                {t("pwaPrompt.later") as string || "Neskôr"}
              </Button>
              <Button onClick={handleInstall} variant="primary" className="btn-sm">
                {t("pwaPrompt.install") as string || "Nainštalovať"}
              </Button>
            </div>
          </>
        )}

        {isIos && (
          <>
            <p className="text-sm opacity-80 mb-4 leading-relaxed">
              {t("pwaPrompt.iosDesc") as string || "Pridaj si aplikáciu na plochu pre rýchly prístup."}
            </p>
            
            {/* Vylepšený Carousel pre iOS návod */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 mb-2 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {iosSteps.map((step, i) => (
                <div key={i} className="shrink-0 w-[85%] snap-center flex flex-col bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="shrink-0 font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">{i + 1}</span>
                    <span className="text-xs sm:text-sm font-medium leading-tight opacity-90">{step.text}</span>
                  </div>
                  <div className="w-full flex-1 bg-black/40 rounded-lg flex items-center justify-center p-2 overflow-hidden shadow-inner">
                    <img 
                      src={step.img} 
                      alt={`Návod krok ${i + 1}`} 
                      className="max-h-40 w-auto object-contain rounded-md" 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end mt-auto">
              <Button onClick={handleDismiss} variant="ghost" className="btn-sm text-gray-400 w-full">
                {t("pwaPrompt.close") as string || "Zavrieť"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}