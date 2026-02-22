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

// Extrahované kapitoly s upravenými textami
const CHAPTERS = [
  {
    id: "welcome",
    tabLabel: "Vitaj",
    title: "Vitaj v Selfrace! 🏁",
    content: (
      <div className="space-y-3">
        <p>Pre ten najlepší zážitok ti odporúčame pridať si apku na plochu, aby fungovala bleskovo a bez rušivých prvkov prehliadača:</p>
        <ul className="list-disc pl-5 opacity-90 space-y-1">
          <li><b>Apple (iOS Safari):</b> Klikni dole na ikonu zdieľania a zvoľ <i>"Pridať na plochu"</i>.</li>
          <li><b>Android (Chrome):</b> Klikni na tri bodky vpravo hore a zvoľ <i>"Pridať na domovskú obrazovku"</i>.</li>
        </ul>
        <p className="text-xs opacity-70 mt-4 italic">
          PS: Ak to teraz zatvoríš, tohto sprievodcu nájdeš kedykoľvek v User Menu (tvoj avatar vpravo hore).
        </p>
      </div>
    ),
  },
  {
    id: "strava_import",
    tabLabel: "Strava & Dáta",
    title: "Pripojenie a Import 🚴‍♂️",
    content: (
      <div className="space-y-3">
        <p>Aby ti tréner mohol radiť, potrebuje tvoje historické dáta.</p>
        <ul className="list-disc pl-5 opacity-90 space-y-1">
          <li><b>1. Pripojenie:</b> V User Menu (avatar) prejdi do <i>"Pripojené aplikácie"</i> a klikni na oranžové tlačidlo <i>Connect with Strava</i>.</li>
          <li><b>2. Import:</b> Na tej istej stránke nižšie následne spusti import aktivít. Odporúčame stiahnuť aspoň pár týždňov dozadu.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "profile_recovery",
    tabLabel: "Môj Stav",
    title: "Profil a Regenerácia 🔋",
    content: (
      <div className="space-y-3">
        <p><b>Tvoj Profil:</b> V User Menu pod <i>"Môj účet"</i> si doplň svoje telesné miery a tepové zóny pre presnejšie výpočty.</p>
        <p><b>Regenerácia:</b> V sekcii <i>Recovery</i> si zapisuj rannú únavu, kvalitu spánku či stres. Zatiaľ to musíš robiť ručne – giganti ako Garmin či Apple s nami zatiaľ nie sú až takí veľkí kamaráti, aby nám to dali automaticky! 😃</p>
      </div>
    ),
  },
  {
    id: "coach",
    tabLabel: "AI Tréner",
    title: "Tréner na mieru 🧠",
    content: (
      <div className="space-y-3">
        <p>Srdce našej aplikácie! Tu si AI Tréner berie tvoje dáta a regeneráciu, aby ti navrhol dokonalý plán.</p>
        <ul className="list-disc pl-5 opacity-90 space-y-1">
          <li><b>Nastavenia (Prefs):</b> Povedz trénerovi, koľko dní v týždni chceš makať a aké máš ciele.</li>
          <li><b>Externé eventy:</b> Plánuješ pretek alebo máš dovolenku? Pridaj si to, tréner to zohľadní.</li>
          <li><b>Generovanie:</b> Stačí kliknúť a tvoj nový tréningový plán je na svete!</li>
        </ul>
      </div>
    ),
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
        const res = await fetch(`/api/prefs/${userId}/key/user.settings`);
        if (!res.ok) throw new Error("Chyba API");
        
        const data = await res.json();
        const settings = data?.value || {};

        if (!settings.onboarding_seen && alive) {
          setIsOpen(true);
        }
      } catch (e) {
        console.error("Nepodarilo sa načítať prefs pre onboarding", e);
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
        const resGet = await fetch(`/api/prefs/${userId}/key/user.settings`);
        const dataGet = resGet.ok ? await resGet.json() : {};
        const currentSettings = dataGet?.value || {};

        await fetch(`/api/prefs/${userId}/key/user.settings`, {
          method: "POST", 
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
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
          });}
        </div>

        {/* OBSAH KAPITOLY */}
        <div className="p-6 sm:p-8 min-h-[260px] flex flex-col justify-start">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">
            {currentChapter.title}
          </h2>
          <div className="text-sm sm:text-base leading-relaxed opacity-80 text-left">
            {currentChapter.content}
          </div>
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
            {activeTab === CHAPTERS.length - 1 ? (t("common.finish") || "Mám to!") : (t("common.close") || "Zavrieť")}
          </Button>

        </div>

      </div>
    </div>
  );
}
