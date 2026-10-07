"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import LangSelector from "@/app/shared/i18n/LangSelector";

import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_INNER_STACK,
} from "@/app/shared/ui/tokens";

import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";

// Import nových komponentov (uprav cesty ak treba)
import AboutStorySK from "./components/AboutStorySK";
import AboutStoryCS from "./components/AboutStoryCS";
import AboutStoryEN from "./components/AboutStoryEN";

export default function AboutPage() {
  const { lang } = useSettings();
  const docLang = lang === "sk" ? "SK" : lang === "cs" ? "CS" : "EN";
  const t = useT();

  return (
    // showPoweredByStrava={true} sa sem hodí viac ako na legal stránky
    <PageShell extraRight={<LangSelector variant="editable" size="xs" />} title={t("ourStory.title") || "Our Story"} showBack showPoweredByStrava={false}>
      <section className={`${CARD} max-w-4xl mx-auto`} style={SURFACE_CARD_STYLE}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          {/* Samotný príbeh */}
          <div className="w-full py-2 px-1 sm:px-4">
            {docLang === "SK" ? <AboutStorySK /> : docLang === "CS" ? <AboutStoryCS /> : <AboutStoryEN />}
          </div>

        </div>
      </section>
    </PageShell>
  );
}