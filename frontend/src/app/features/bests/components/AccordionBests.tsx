// src/features/bests/components/AccordionBests.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  SURFACE_CARD,
  SURFACE_SUBCARD,
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

// lazy import – nech sa PBRun nenačítava zbytočne
const PBRun = dynamic(() => import("@/app/features/bests/components/PBRun"), {
  ssr: false,
});

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);

  return (
    <div className={PANEL_STACK}>
      {/* RUN */}
      <section className={SURFACE_CARD}>
        <header
          onClick={() => setOpenRun((v) => !v)}
          className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}
        >
          <h3 className={PANEL_CARD_TITLE}>Personal Bests — Running</h3>
          <span className={PANEL_BADGE}>{openRun ? "▾" : "▸"}</span>
        </header>

        {openRun && (
          <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}>
            <PBRun />
          </div>
        )}

        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* placeholdery (rovnaký look, disabled) */}
      {[
        "Personal Bests — Cycling",
        "Personal Bests — Strength",
        "Personal Bests — Swimming",
      ].map((title) => (
        <section key={title} className={SURFACE_SUBCARD}>
          <header
            className={[
              PANEL_PAD,
              PANEL_CARD_HEAD,
              ACCORDION_DISABLED,
            ].join(" ")}
          >
            <h3 className={PANEL_CARD_TITLE}>{title}</h3>
            <span className={PANEL_PREVIEW}>soon</span>
          </header>
          <div className={ACCORDION_FOOTER_BAR_MUTED} />
        </section>
      ))}
    </div>
  );
}