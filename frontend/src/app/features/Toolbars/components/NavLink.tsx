// src/features/Toolbars/NavLink.tsx
"use client";

import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { appColors } from "@/app/shared/theme/app_colors";

export default function NavLink({
  href,
  children,
  onClick,
}: LinkProps & { children: ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    typeof href === "string"
      ? pathname === href || pathname.startsWith(String(href) + "/")
      : false;

  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2 rounded-lg transition-colors"
      style={{
        background: isActive ? appColors.surfaceCardHover : "transparent",
        color: appColors.textPrimary,
      }}
      onMouseEnter={(e) => {
        if (isActive) return;
        (e.currentTarget as HTMLAnchorElement).style.background =
          appColors.buttonGhostBgHover;
      }}
      onMouseLeave={(e) => {
        if (isActive) return;
        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      {children}
    </Link>
  );
}