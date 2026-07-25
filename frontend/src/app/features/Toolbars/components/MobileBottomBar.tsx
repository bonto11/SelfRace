// src/app/features/Toolbars/components/MobileBottomBar.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  NavIcon,
  type NavId,
} from "@/app/features/Toolbars/components/navIcons";

type ItemDef = {
  id: NavId;
  href: string;
  translationKey: string;
};

const ITEMS: ItemDef[] = [
  { id: "activities",  href: "/activities",  translationKey: "activities.title" },
  { id: "coach",       href: "/coach",       translationKey: "coach.title" },
  { id: "performance", href: "/performance", translationKey: "performance.title" },
  { id: "recovery",    href: "/recovery",    translationKey: "recovery.title" },
  { id: "calendar",    href: "/calendar",    translationKey: "calendar.title" },
];

function resetAppScroll() {
  document.getElementById("app-scroll-desktop")?.scrollTo({ top: 0, left: 0 });
  document.getElementById("app-scroll-mobile")?.scrollTo({ top: 0, left: 0 });
}

// 🌟 OBCHÁDZKOVÉ RIEŠENIE: "Späť" tlačidlo/gesto spoľahlivo vyčistí zaseknutý
// scroll/layout stav (dôvod nateraz neznámy), zatiaľ čo priama SPA navigácia
// (Link/router.push) na inú stránku ho zdedí. Preto pri kliku na spodné menu
// najprv urobíme history.back() (vyčistí stav), a hneď nato presmerujeme na
// skutočný cieľ - rovnaký efekt ako ručné "Späť + klik znova", len automaticky.
function navigateWithBackFirst(
  router: ReturnType<typeof useRouter>,
  currentPath: string,
  targetHref: string,
) {
  if (currentPath === targetHref) {
    resetAppScroll();
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
    // Krátky delay, aby sa back-navigácia stihla spracovať skôr, než
    // pushneme dopredu na skutočný cieľ.
    setTimeout(() => {
      router.push(targetHref);
    }, 60);
  } else {
    router.push(targetHref);
  }
}

function BottomNavItem({ id, href, translationKey }: ItemDef) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const label = t(translationKey as any);

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigateWithBackFirst(router, pathname, href);
      }}
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
    </a>
  );
}

function BottomBarContent() {
  const t = useT();

  return (
    <nav
      id="mobile-bottom-nav"
      className={[
        "lg:hidden",
        "fixed bottom-0 inset-x-0 z-40",
        "pb-[calc(12px+env(safe-area-inset-bottom))] pt-2",
        "flex justify-center",
      ].join(" ")}
      aria-label={t("common.nav.mobileAria" as any)}
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

export default function MobileBottomBar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(<BottomBarContent />, document.body);
}
