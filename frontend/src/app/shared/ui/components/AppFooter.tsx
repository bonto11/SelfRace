// src/app/shared/ui/components/AppFooter.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_PAD } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function AppFooter() {
  const t = useT();
  const router = useRouter();
  
  // Používame useRef, aby sme pri každom kliku zbytočne neprekresľovali komponent
  const clickCount = useRef(0);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSecretClick = () => {
    clickCount.current += 1;

    // Ak niekto klikne 5x po sebe, odomkne sa brána
    if (clickCount.current >= 5) {
      router.push("/hq-secure-zone");
      clickCount.current = 0; // reset
    }

    // Zrušíme starý timeout a nastavíme nový
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    
    // Ak prejdú 2 sekundy bez kliknutia, počítadlo sa vynuluje
    clickTimeout.current = setTimeout(() => {
      clickCount.current = 0;
    }, 2000);
  };

  return (
    <footer
      style={{
        borderTop: `1px solid ${appColors.divider}`,
        background: appColors.backgroundAlt,
      }}
    >
      <div
        className={[
          PANEL_PAD,
          "max-w-screen-lg mx-auto",
          // Na mobile flex-col (pod sebou), na väčších flex-row (vedľa seba)
          "flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-3",
        ].join(" ")}
      >
        {/* TAJNÉ DVERE: Pridaný onClick, select-none a cursor-default */}
        <div 
          onClick={handleSecretClick}
          className="text-xs text-center sm:text-left cursor-default select-none" 
          style={{ color: appColors.textMuted }}
          title="" // Trik, aby sa nezobrazil default tooltip ak na to niekto prejde myšou
        >
          © {new Date().getFullYear()} SelfRace
        </div>

        <nav 
          // Na mobile sa linky vycentrujú a ak sa nezmestia, zalamujú sa pekne do ďalšieho riadku
          className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-3 text-xs"
        >
          <Link
            href="/privacy"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            {t("appFooter.privacy")}
          </Link>
          <Link
            href="/terms"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            {t("appFooter.terms")}
          </Link>
          <Link
            href="/contact"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            {t("appFooter.contact")}
          </Link>
          <Link
            href="/ourStory"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            {t("appFooter.ourStory")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}