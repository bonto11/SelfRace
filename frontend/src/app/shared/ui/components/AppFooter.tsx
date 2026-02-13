// src/app/shared/ui/components/AppFooter.tsx
"use client";

import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_PAD } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function AppFooter() {
  const t = useT(); 
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
        <div 
          className="text-xs text-center sm:text-left" 
          style={{ color: appColors.textMuted }}
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
