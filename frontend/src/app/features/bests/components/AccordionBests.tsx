// src/features/bests/components/AccordionBests.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import {
  PANEL_STACK, PANEL_PAD, PANEL_CARD_HEAD, PANEL_CARD_TITLE, PANEL_BADGE,
  ACCORDION_TOGGLE, ACCORDION_BODY_NO_TOP, ACCORDION_FOOTER_BAR,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD, SESSION_CARD_STYLE, SESSION_SUBCARD, SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";
import { useT } from "@/app/shared/i18n/useT";

const PBRun = dynamic(() => import("@/app/features/bests/components/PBRun"), { ssr: false });
const PBBike = dynamic(() => import("@/app/features/bests/components/PBBike"), { ssr: false });
const PBSwim = dynamic(() => import("@/app/features/bests/components/PBSwim"), { ssr: false });
const PBTriathlon = dynamic(() => import("@/app/features/bests/components/PBTriathlon"), { ssr: false });
const PBOcr = dynamic(() => import("@/app/features/bests/components/PBOcr"), { ssr: false });
const PBHyrox = dynamic(() => import("@/app/features/bests/components/PBHyrox"), { ssr: false });
const PBStrength = dynamic(() => import("@/app/features/bests/components/PBStrength"), { ssr: false });

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);
  const [openBike, setOpenBike] = useState(false);
  const [openSwim, setOpenSwim] = useState(false);
  const [openTriathlon, setOpenTriathlon] = useState(false);
  const [openOcr, setOpenOcr] = useState(false);
  const [openHyrox, setOpenHyrox] = useState(false);
  const [openStrength, setOpenStrength] = useState(false);
  
  const t = useT();

  return (
    <div className={PANEL_STACK}>
      {/* RUN */}
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <header onClick={() => setOpenRun(!openRun)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>{t("PB.run.title") || "Beh"}</h3>
          <span className={PANEL_BADGE}>{openRun ? "▾" : "▸"}</span>
        </header>
        {openRun && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBRun /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* BIKE */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenBike(!openBike)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>{t("PB.bike.title") || "Cyklistika"}</h3>
          <span className={PANEL_BADGE}>{openBike ? "▾" : "▸"}</span>
        </header>
        {openBike && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBBike /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* SWIM */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenSwim(!openSwim)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>{t("PB.swim.title") || "Plávanie"}</h3>
          <span className={PANEL_BADGE}>{openSwim ? "▾" : "▸"}</span>
        </header>
        {openSwim && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBSwim /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* TRIATHLON */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenTriathlon(!openTriathlon)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>{t("PB.triathlon.title") || "Triatlon"}</h3>
          <span className={PANEL_BADGE}>{openTriathlon ? "▾" : "▸"}</span>
        </header>
        {openTriathlon && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBTriathlon /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* SPARTAN RACE (OCR) */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenOcr(!openOcr)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>Spartan Race</h3>
          <span className={PANEL_BADGE}>{openOcr ? "▾" : "▸"}</span>
        </header>
        {openOcr && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBOcr /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* HYROX */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenHyrox(!openHyrox)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>Hyrox</h3>
          <span className={PANEL_BADGE}>{openHyrox ? "▾" : "▸"}</span>
        </header>
        {openHyrox && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBHyrox /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

      {/* STRENGTH */}
      <section className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
        <header onClick={() => setOpenStrength(!openStrength)} className={[PANEL_PAD, PANEL_CARD_HEAD, ACCORDION_TOGGLE].join(" ")}>
          <h3 className={PANEL_CARD_TITLE}>{t("PB.strength.title") || "Silový tréning"}</h3>
          <span className={PANEL_BADGE}>{openStrength ? "▾" : "▸"}</span>
        </header>
        {openStrength && <div className={[PANEL_PAD, ACCORDION_BODY_NO_TOP].join(" ")}><PBStrength /></div>}
        <div className={ACCORDION_FOOTER_BAR} />
      </section>

    </div>
  );
}