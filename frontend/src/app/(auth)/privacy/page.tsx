"use client";

import React from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_INNER_STACK,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

// Import našich nových textových komponentov (uprav cestu ak ich máš inde)
import PrivacyPolicyEN from "./components/PrivacyPolicyEN";
import PrivacyPolicySK from "./components/PrivacyPolicySK";

export default function PrivacyPage() {
  const { lang } = useSettings();
  const t = useT();

  const isSk = lang === "sk";
  
  // Link pre stiahnutie pôvodného PDF dokumentu
  const pdfFileName = isSk
    ? "PrivacyPolicy_SelfRace_SK.pdf"
    : "PrivacyPolicy_SelfRace_EN.pdf";
  const pdfPath = `/documents/${pdfFileName}`;

  return (
    <PageShell title={t("privacy.title")} showBack showPoweredByStrava={false}>
      <section className={`${CARD}`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          
          {/* Odkaz na stiahnutie PDFka - zarovnaný doprava, decentný */}
          <div className="flex justify-end w-full pb-4 border-b" style={{ borderColor: appColors.divider }}>
            <a
              href={pdfPath}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-2 transition-colors"
              style={{ 
                color: appColors.textPrimary,
                backgroundColor: "rgba(255,255,255,0.05)"
              }}
              download
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {t("common.downloadPDF") || "Stiahnuť PDF"}
            </a>
          </div>

          {/* Samotný text z komponentu */}
          <div className="w-full pt-2">
            {isSk ? <PrivacyPolicySK /> : <PrivacyPolicyEN />}
          </div>

        </div>
      </section>
    </PageShell>
  );
}