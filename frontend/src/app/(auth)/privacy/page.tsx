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

export default function PrivacyPage() {
  // 1. Získame aktuálny jazyk
  const { lang } = useSettings();
  const t = useT();

  // 2. Určíme cestu k PDF podľa jazyka
  const isSk = lang === "sk";
  const pdfFileName = isSk
    ? "PrivacyPolicy_SelfRace_SK.pdf"
    : "PrivacyPolicy_SelfRace_EN.pdf";

  const pdfPath = `/documents/${pdfFileName}`;

  return (
    <PageShell title={t("privacy.title")} showBack>
      <section className={`${CARD}`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          
          {/* Odkaz na stiahnutie - zarovnaný doprava */}
          <div className="flex justify-end w-full">
            <a
              href={pdfPath}
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
              download
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
    </PageShell>
  );
}
