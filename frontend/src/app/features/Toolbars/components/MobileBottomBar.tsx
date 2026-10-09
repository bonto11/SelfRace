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
import { useWidgetLayout } from "@/app/shared/widgets/useWidgetLayout";
import type { WidgetSection } from "@/app/shared/widgets/widgetCatalog";

type ItemDef = {
  id: NavId;
  href: string;
  translationKey: string;
  /** sekcia sa ukáže, len keď má aspoň jeden zapnutý widget */
  section?: WidgetSection;
};

// Kalendár nemá vlastnú položku – je ako widget na Domove (preklik na /calendar).
const ITEMS: ItemDef[] = [
  { id: "home",        href: "/dashboard",   translationKey: "home.title" },
  { id: "activities",  href: "/activities",  translationKey: "activities.title", section: "activities" },
  { id: "coach",       href: "/coach",       translationKey: "coach.title", section: "coach" },
  { id: "performance", href: "/performance", translationKey: "performance.title", section: "performance" },
  { id: "recovery",    href: "/recovery",    translationKey: "recovery.title", section: "recovery" },
];

function resetAppScroll() {
  document.getElementById("app-scroll")?.scrollTo({ top: 0, left: 0 });
}

// Z vnorenej stránky (napr. /coach/prefs) ideme cez replace - nevnorená
// stránka sa v histórii nehromadí a nič neprebliká. Predtým tu bol
// "back-first" trik (history.back + o 60 ms push), ktorý na chvíľu
// vykreslil medzistránku; obchádzal zaseknutý scroll pri dvoch scroll
// kontajneroch v shelli, ktoré už nie sú.
function isNestedPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return segments.length > 1;
}

function navigate(
  router: ReturnType<typeof useRouter>,
  currentPath: string,
  targetHref: string,
) {
  if (currentPath === targetHref) {
    resetAppScroll();
    return;
  }
  if (isNestedPath(currentPath)) router.replace(targetHref);
  else router.push(targetHref);
}

function BottomNavItem({
  id,
  href,
  translationKey,
  active,
  onNavigate,
}: Omit<ItemDef, "section"> & { active: boolean; onNavigate: (href: string) => void }) {
  const t = useT();
  const label = t(translationKey as any);

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      className="flex flex-col items-center min-w-[60px]"
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <div
        className="flex items-center justify-center rounded-2xl w-[60px] h-9 transition-colors duration-200"
        style={{
          background: active ? appColors.brandPrimary : "transparent",
          color: active ? appColors.textInverse : appColors.textPrimary,
        }}
      >
        {NavIcon({ id })}
      </div>
      <span
        className="mt-1 text-[11px] leading-none truncate transition-colors duration-200"
        style={{
          color: active ? appColors.textPrimary : appColors.textMuted,
        }}
      >
        {label}
      </span>
    </a>
  );
}

function BottomBarContent() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { sectionVisible } = useWidgetLayout();
  const items = ITEMS.filter((it) => !it.section || sectionVisible(it.section));

  // zvýraznenie sa prepne hneď po ťuknutí, nie až keď dobehne navigácia
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // hlavné sekcie vopred načítané - prepnutie je okamžité
  useEffect(() => {
    ITEMS.forEach((it) => router.prefetch(it.href));
  }, [router]);

  const isActive = (href: string) =>
    pendingHref
      ? pendingHref === href
      : pathname === href || pathname.startsWith(href + "/");

  const onNavigate = (href: string) => {
    if (pathname !== href) setPendingHref(href);
    navigate(router, pathname, href);
  };

  return (
    // id="mobile-bottom-nav" — TrendRHR (a iné grafy) ho priamo schovajú/ukážu cez DOM
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
          {items.map((item) => (
            <BottomNavItem
              key={item.id}
              id={item.id}
              href={item.href}
              translationKey={item.translationKey}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function MobileBottomBar() {
  // FIX: renderované cez React portal priamo do document.body.
  // Predtým bola lišta síce "position: fixed", ale stále súčasťou React
  // stromu vnoreného pod viacero rodičovských divov v ClientProtectedShell.
  // Ak čokoľvek nad ňou (aj dočasne, napr. animácia/transition triedou)
  // dostane CSS transform/filter/will-change, prehliadač podľa CSS
  // špecifikácie vytvorí nový "containing block" a fixed potomkovia sa
  // zrazu viažu na TOHO rodiča namiesto viewportu - navigácia potom
  // "pláva" so scrollom namiesto toho, aby zostala prilepená dole.
  // Portál do document.body toto úplne vylučuje, lebo lišta už nie je
  // potomkom žiadneho z tých divov.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(<BottomBarContent />, document.body);
}
