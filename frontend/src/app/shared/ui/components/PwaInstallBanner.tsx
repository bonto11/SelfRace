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

    // 1. Zistenie, či už je appka nainštalovaná (standalone režim)
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) return;

    // 2. Zistenie iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Zachytenie Android inštalačného eventu
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. Kontrola v DB a zobrazenie
    const checkAndShow = async () => {
      try {
        const currentSettings = (await apiFetchUserPref(userId, "user.settings")) || {};
        
        // Ak ešte nevidel Onboarding, necháme ho tak
        if (!currentSettings.onboarding_seen) return;
        
        // Ak už PWA inštaláciu odmietol alebo vykonal
        if (currentSettings.pwa_prompt_dismissed) return;

        // Dáme tomu 6 sekúnd delay, aby to nekolidovalo s Push Notifikáciami
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
    
    // Vyvolanie natívneho Android inštalačného dialógu
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("Užívateľ nainštaloval PWA");
      markAsDismissed();
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    markAsDismissed();
  };

  // Zobrazíme iba v prípade, že je to iOS, ALEBO máme pripravený Android event
  if (!showPrompt || (!isIos && !deferredPrompt)) return null;

  return (
    <div className="fixed inset-0 z-[99997] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-sm bg-base-100 rounded-2xl shadow-2xl p-6 flex flex-col transform transition-all"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${appColors.brandPrimary}20`, color: appColors.brandPrimary }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">
          Stiahni si SelfRace
        </h3>

        {/* --- ANDROID VERZIA --- */}
        {!isIos && (
          <>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">
              Pridaj si aplikáciu priamo na plochu telefónu pre rýchlejší prístup, lepšie notifikácie a plný zážitok.
            </p>
            <div className="flex gap-3 justify-end mt-auto">
              <Button onClick={handleDismiss} variant="ghost" className="btn-sm text-gray-400">
                Neskôr
              </Button>
              <Button onClick={handleInstall} variant="primary" className="btn-sm">
                Inštalovať aplikáciu
              </Button>
            </div>
          </>
        )}

        {/* --- iOS VERZIA --- */}
        {isIos && (
          <>
            <p className="text-sm opacity-80 mb-4 leading-relaxed">
              Pridaj si aplikáciu na plochu iPhonu. Postupuj podľa tohto návodu:
            </p>
            
            <div className="bg-white/5 rounded-lg p-4 mb-6 flex flex-col items-center border border-white/10">
              <ol className="text-sm opacity-90 text-left space-y-3 w-full mb-4">
                <li className="flex items-center gap-2">
                  <span className="font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span> 
                  Klikni na ikonu <b>Zdieľať</b> dole v lište
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span> 
                  Vyber <b>Pridať na plochu</b> (Add to Home Screen)
                </li>
              </ol>
              
              {/* Nahraď obrázkom (napr. screenshot z iOS Safari). Pre teraz pekný placeholder. */}
              <div className="w-full h-24 bg-base-200 rounded flex items-center justify-center border border-dashed border-gray-600">
                <span className="text-xs opacity-50">Tvoj ilustračný iOS obrázok</span>
                {/* <img src="/images/ios-pwa-guide.png" alt="iOS Guide" className="max-h-full" /> */}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-auto">
              <Button onClick={handleDismiss} variant="ghost" className="btn-sm text-gray-400 w-full">
                Rozumiem, zavrieť
              </Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
