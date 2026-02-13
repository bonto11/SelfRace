// src/features/bests/components/AccordionBests.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_BADGE,
  PANEL_PREVIEW,
  ACCORDION_TOGGLE,
  ACCORDION_BODY_NO_TOP,
  ACCORDION_DISABLED,
  ACCORDION_FOOTER_BAR,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";
import { useT } from "@/app/shared/i18n/useT";

const PBRun = dynamic(() => import("@/app/features/bests/components/PBRun"), {
  ssr: false,
});

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);
  const t = useT();

  return (
    <div className={PANEL_STACK}>
      {/* RUN */}
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <header
          onClick={() => setOpenRun((v) => !v)}
          className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}
        >
          <h3 className={PANEL_CARD_TITLE}>{t("PB.run.title")}</h3>
          <span className={PANEL_BADGE}>{openRun ? "▾" : "▸"}</span>
        </header>

        {openRun && (
          <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}>
            <PBRun />
          </div>
        )}

        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* placeholdery */}
      {[t("PB.bike.title"), t("PB.swim.title"), t("PB.strength.title")].map(
        (title) => (
          <section
            key={title}
            className={SESSION_SUBCARD}
            style={SESSION_SUBCARD_STYLE}
          >
            <header
              className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_DISABLED].join(
                " ",
              )}
            >
              <h3 className={PANEL_CARD_TITLE}>{title}</h3>
              <span className={PANEL_PREVIEW}> {t("common.soon")},</span>
            </header>
            <div className={ACCORDION_FOOTER_BAR_MUTED} />
          </section>
        ),
      )}
    </div>
  );
}
