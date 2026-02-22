"use client";

import { useState, useEffect } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  userId: number;
  forceShow?: boolean; 
  onCloseManual?: () => void;
};

const CHAPTERS = [
  {
    id: "welcome",
    tabLabel: "Vitaj",
    title: "Vitaj v Selfrace! 🏁",
    content: "Pre ten najlepší zážitok z aplikácie ti odporúčame pridať si ju na plochu telefónu. V Safari (iPhone) klikni dole na ikonu zdieľania a vyber 'Pridať na plochu'. Bude fungovať presne ako rýchla natívna apka.",
  },
  {
    id: "strava",
    tabLabel: "Strava",
    title: "Prepoj si Stravu 🚴‍♂️",
    content: "Bez dát to nepôjde. V sekcii Nastavenia si jedným klikom prepoj svoj Strava účet. Tvoje dáta sú u nás v bezpečí a tréner k nim získa prístup.",
  },
  {
    id: "import",
    tabLabel: "Import",
    title: "Stiahni si aktivity 📥",
    content: "Po prepojení Stravy choď do sekcie Aktivity a spusti import. Tréner potrebuje vidieť tvoju históriu (aspoň pár týždňov), aby vedel odhadnúť tvoju aktuálnu kondíciu a zóny.",
  },
  {
    id: "coach",
    tabLabel: "Tréner",
    title: "AI Tréner a Únava 🔋",
    content: "V sekcii Recovery vidíš svoju dennú únavu. Na základe nej ti tvoj AI Tréner každý deň namixuje tréning presne na mieru. Dodržuj zóny a sleduj, ako napreduješ!",
  }
];

export default function OnboardingWizard({ userId, forceShow = false, onCloseManual }: Props) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // 1. NAČÍTANIE PREFERENCIÍ PRI ŠTARTE
  useEffect(() => {
    if (!userId) return;

    if (forceShow) {
      setIsOpen(true);
      setIsLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        // Zavoláme tvoj endpoint pre načítanie nastavení
        const res = await fetch(`/prefs/${userId}/key/user.settings`);
        if (!res.ok) throw new Error("Chyba API");
        
        const data = await res.json();
        const settings = data?.value || {};

        // Ak užívateľ nemá nastavené onboarding_seen na true, ukážeme modal
        if (!settings.onboarding_seen && alive) {
          setIsOpen(true);
        }
      } catch (e) {
        console.error("Nepodarilo sa načítať prefs pre onboarding", e);
        // V prípade chyby radšej ukážeme (alebo môžeme schovať, podľa preferencie)
        if (alive) setIsOpen(true); 
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId, forceShow]);

  // 2. ULOŽENIE A ZATVORENIE
  const handleDismiss = async () => {
    setIsOpen(false);
    if (onCloseManual) onCloseManual();

    if (!forceShow) {
      try {
        // Stiahneme aktuálne nastavenia, aby sme ich neprepísali, len doplnili
        const resGet = await fetch(`/prefs/${userId}/key/user.settings`);
        const dataGet = resGet.ok ? await resGet.json() : {};
        const currentSettings = dataGet?.value || {};

        // Uložíme aktualizované nastavenia späť do DB
        await fetch(`/prefs/${userId}/key/user.settings`, {
          method: "POST", // Alebo PUT, podľa toho ako máš API
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...currentSettings,
            onboarding_seen: true
          }),
        });
      } catch (e) {
        console.error("Nepodarilo sa uložiť prefs pre onboarding", e);
      }
    }
  };

  if (isLoading || !isOpen) return null;

  const currentChapter = CHAPTERS[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
      <div 
        className="w-full max-w-md bg-base-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col transform transition-all"
        style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
      >
        
        {/* ZÁLOŽKY (TABS) */}
        <div className="flex overflow-x-auto border-b hide-scrollbar" style={{ borderColor: appColors.surfaceCardBorder }}>
          {CHAPTERS.map((chap, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={chap.id}
                onClick={() => setActiveTab(idx)}
                className={`flex-1 min-w-[80px] py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap px-2 ${
                  isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
                style={{
                  borderBottom: isActive ? `2px solid ${appColors.brandPrimary}` : "2px solid transparent"
                }}
              >
                {chap.tabLabel}
              </button>
            );
          })}
        </div>

        {/* OBSAH KAPITOLY */}
        <div className="p-6 sm:p-8 min-h-[220px] flex flex-col justify-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 text-white">
            {currentChapter.title}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed opacity-80">
            {currentChapter.content}
          </p>
        </div>

        {/* FOOTER A TLAČIDLÁ */}
        <div className="p-4 sm:p-6 bg-base-200/30 flex justify-between items-center" style={{ borderTop: `1px solid ${appColors.surfaceCardBorder}` }}>
          
          <div className="flex gap-2">
            {activeTab > 0 && (
              <button 
                onClick={() => setActiveTab(prev => prev - 1)}
                className="btn btn-sm btn-ghost text-xs"
              >
                Späť
              </button>
            )}
            {activeTab < CHAPTERS.length - 1 && (
              <button 
                onClick={() => setActiveTab(prev => prev + 1)}
                className="btn btn-sm btn-outline text-xs"
                style={{ borderColor: appColors.brandPrimary, color: appColors.brandPrimary }}
              >
                Ďalej
              </button>
            )}
          </div>

          <Button onClick={handleDismiss} variant="primary" className="btn-sm sm:btn-md">
            {t("common.close") || "Rozumiem, zavrieť"}
          </Button>

        </div>

      </div>
    </div>
  );
}
