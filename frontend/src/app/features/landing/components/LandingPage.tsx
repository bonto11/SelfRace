"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBackdrop from "@/app/shared/ui/components/AppBackdrop";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import type { UiLang } from "@/app/shared/i18n/locale";
import { useLandingT } from "../hooks/useLandingT";
import LandingWeb from "./LandingWeb";
import LandingCompact from "./LandingCompact";

export default function LandingPage({ initialLang }: { initialLang: UiLang }) {
  const t = useLandingT(initialLang);
  const router = useRouter();
  const [iosStandalone, setIosStandalone] = useState(false);

  useEffect(() => {
    // Prihláseného pošle na Domov už middleware – toto je poistka, keby server session nevidel.
    const checkAuth = async () => {
      try {
        const { data } = await getSupabaseBrowser().auth.getSession();
        if (data.session?.user) router.replace("/dashboard");
      } catch {}
    };
    void checkAuth();
    // Starší iOS nehlási display-mode: standalone, len navigator.standalone
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
      setIosStandalone(true);
    }
  }, [router]);

  /*
   * PREČO CSS a nie JS: stránka sa vykreslí už na serveri, aby človek z reklamy
   * videl obsah hneď (predtým čakal na JS pri prázdnej obrazovke). Či ide o PWA
   * z plochy, server nevie – rozhodne media query display-mode bez prebliknutia.
   * V PWA user appku pozná, stačí mu krátka karta s prihlásením.
   */
  return (
    <AppBackdrop>
      <div className={iosStandalone ? "hidden" : "[@media(display-mode:standalone)]:hidden"}>
        <LandingWeb t={t} />
      </div>
      <div className={iosStandalone ? "" : "hidden [@media(display-mode:standalone)]:block"}>
        <LandingCompact t={t} />
      </div>
    </AppBackdrop>
  );
}
