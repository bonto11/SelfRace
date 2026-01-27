// src/app/features/Toolbars/components/MobileBottomBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  NavIcon,
  type NavId,
} from "@/app/features/Toolbars/components/navIcons";

type ItemDef = {
  id: NavId;
  href: string;
  label: string;
};

const ITEMS: ItemDef[] = [
  { id: "activities", href: "/activities", label: "Aktivity" },
  { id: "coach", href: "/coach", label: "Coach" },
  { id: "profile", href: "/profile", label: "Profil" },
  { id: "recovery", href: "/recovery", label: "Recovery" },
  { id: "calendar", href: "/calendar", label: "Kalendár" },
];

function BottomNavItem({ id, href, label }: ItemDef) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="flex flex-col items-center min-w-[60px]"
      aria-label={label}
    >
      <div
        className="flex items-center justify-center rounded-2xl w-[60px] h-9 transition-colors"
        style={{
          background: isActive ? appColors.brandPrimary : "transparent",
          color: isActive ? appColors.textInverse : appColors.textPrimary,
        }}
      >
        {NavIcon({ id })}
      </div>

      <span
        className="mt-1 text-[11px] leading-none truncate"
        style={{
          color: isActive ? appColors.textPrimary : appColors.textMuted,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function MobileBottomBar() {
  return (
    <nav
      className={[
        "lg:hidden",
        "fixed bottom-0 inset-x-0 z-40",
        "pb-[calc(12px+env(safe-area-inset-bottom))] pt-2",
        "flex justify-center",
      ].join(" ")}
      aria-label="Hlavná mobilná navigácia"
    >
      <div className="max-w-screen-sm w-full px-3 flex justify-center">
        <div
          className="mb-[3px] inline-flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-sm shadow-lg"
          style={{
            background: appColors.panelBg,
            border: `1px solid ${appColors.panelBorder}`,
            boxShadow: appColors.shadowSoft,
          }}
        >
          {ITEMS.map((item) => (
            <BottomNavItem key={item.id} {...item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
