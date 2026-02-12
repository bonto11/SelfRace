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
import { useT } from "@/app/shared/i18n/useT";

export default function TermsPage() {
  // 1. Získame jazyk
  const { lang } = useSettings();
  const isSk = lang === "sk";
  const t = useT();

  // 2. Dynamická cesta k PDF
  const pdfFileName = isSk
    ? "TermsOfService_SelfRace_SK.pdf"
    : "TermsOfService_SelfRace_EN.pdf";
  const pdfPath = `/documents/${pdfFileName}`;

  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={`${CARD}`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>{t("terms.title")}</h1>
            <a
              href={pdfPath}
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
              download // Pridané pre priame stiahnutie
            >
              {t("common.downloadPDF")}
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
                {t("common.showPDFError")}
                <a
                  href={pdfPath}
                  className="ml-2 underline"
                  style={{ color: appColors.textPrimary }}
                >
                  {t("common.downloadPDF")}
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
