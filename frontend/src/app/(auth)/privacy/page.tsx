"use client";

import React from "react";
import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useSettings } from "@/app/shared/i18n/SettingsProvider"; // Importujeme hook pre settings
// import { useT } from "@/app/shared/i18n/useT"; // Ak by ste chceli použiť preklady textov

export default function PrivacyPage() {
  // 1. Získame aktuálny jazyk
  const { lang } = useSettings();
  
  // (Voliteľné) Hook pre preklady
  // const t = useT();

  // 2. Určíme cestu k PDF podľa jazyka
  // Predpoklad: slovenská verzia je '_SK.pdf', anglická je bez suffixu alebo '_EN.pdf'
  const isSk = lang === "sk";
  const pdfFileName = isSk 
    ? "PrivacyPolicy_SelfRace_SK.pdf" 
    : "PrivacyPolicy_SelfRace_EN.pdf";
    
  const pdfPath = `/documents/${pdfFileName}`;

  // 3. Texty (jednoduchý prepínač, ak ešte nemáte kľúče v useT)
  const title = isSk ? "Zásady ochrany osobných údajov" : "Privacy Policy";
  const downloadText = isSk ? "Stiahnuť PDF" : "Download PDF";
  const fallbackText = isSk 
    ? "Váš prehliadač nedokáže zobraziť PDF." 
    : "Your browser can’t display PDFs inline.";

  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={`${CARD}`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>{title}</h1>
            <a
              href={pdfPath} // Dynamická cesta
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
              download // Pridaný atribút pre priame stiahnutie
            >
              {downloadText}
            </a>
          </div>

          <div
            className="w-full overflow-hidden rounded-xl border"
            style={{
              borderColor: appColors.divider,
              background: appColors.backgroundAlt,
            }}
          >
            <object
              data={pdfPath} // Dynamická cesta pre zobrazenie
              type="application/pdf"
              width="100%"
              height="780"
            >
              <div
                className="p-3 text-sm"
                style={{ color: appColors.textSecondary }}
              >
                {fallbackText}{" "}
                <a
                  href={pdfPath} // Dynamická cesta pre fallback link
                  className="ml-2 underline"
                  style={{ color: appColors.textPrimary }}
                >
                  {downloadText}
                </a>
                .
              </div>
            </object>
          </div>
        </div>
      </section>
    </main>
  );
}
