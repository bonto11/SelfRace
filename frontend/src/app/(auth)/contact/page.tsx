"use client";

import React from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export default function ContactPage() {
  const t = useT();

  return (
    <PageShell title={t("contact.title")} showBack showPoweredByStrava={false}>
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          
          {/* Obsah kontaktu */}
          <div
            className="text-sm leading-6 space-y-3"
            style={{ color: appColors.textSecondary }}
          >
            <p>{t("contact.message")}</p>
            <p className="font-medium" style={{ color: appColors.textPrimary }}>
              support@selfrace.com
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
