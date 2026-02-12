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
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

export default function AboutPage() {
  // 1. Získame jazyk
  const { lang } = useSettings();
  const isSk = lang === "sk";

  // 2. Dynamická cesta k PDF
  // Názvy súborov si uprav podľa toho, ako ich reálne pomenuješ
  const pdfFileName = isSk
    ? "About_SelfRace_SK.pdf"
    : "About_SelfRace.pdf";
  const pdfPath = `/documents/${pdfFileName}`;

  // 3. Texty
  // Tu skúsime dať trochu teplejší nadpis, nie len "About"
  const title = isSk ? "Náš príbeh & Misia" : "Our Story & Mission";
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
              href={pdfPath}
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
              download
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
              data={pdfPath}
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
                  href={pdfPath}
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
