// src/app/shared/ui/components/AppFooter.tsx
"use client";

import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_PAD } from "@/app/shared/ui/tokens";

export default function AppFooter() {
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
          "flex flex-wrap items-center justify-between gap-3",
        ].join(" ")}
      >
        <div className="text-xs" style={{ color: appColors.textMuted }}>
          © {new Date().getFullYear()} SelfRace
        </div>

        <nav className="flex items-center gap-3 text-xs">
          <Link
            href="/privacy"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="hover:underline"
            style={{ color: appColors.textSecondary }}
          >
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}