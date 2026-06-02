"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

function BottomNavItem({ id, href, translationKey }: ItemDef) {
  const t = useT();
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const label = t(translationKey as any);

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
  const t = useT();

  // Schovaj sa keď je aktívny fullscreen chart overlay.
  // TrendRHR (a iné grafy) pridajú triedu "chart-fullscreen" na document.body.
  // MutationObserver detekuje zmenu a nav sa skryje/ukáže bez re-renderu celého stromu.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const check = () => {
      setHidden(document.body.classList.contains("chart-fullscreen"));
    };
    check(); // inicializácia

    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <nav
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
