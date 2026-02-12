// src/app/contact/page.tsx
"use client";

import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export default function ContactPage() {
  const t = useT();
  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>{t("contact.title")}</h1>
          </div>

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
    </main>
  );
}
