// src/app/features/Toolbars/components/MobileBottomBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavKey = "activities" | "coach" | "profile" | "recovery" | "calendar";

type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  iconSrc: string; // cesta do /public
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "activities",
    href: "/activities",
    label: "Aktivity",
    iconSrc: "/activityIcon.svg",
  },
  {
    key: "coach",
    href: "/coach",
    label: "Coach",
    iconSrc: "/coachIcon.svg",
  },
  {
    key: "profile",
    href: "/profile",
    label: "Profil",
    iconSrc: "/profileIcon.svg",
  },
  {
    key: "recovery",
    href: "/recovery",
    label: "Recovery",
    iconSrc: "/recoveryIcon.svg",
  },
  {
    key: "calendar",
    href: "/calendar",
    label: "Kalendár",
    iconSrc: "/calendarIcon.svg",
  },
];

function IconWithFallback({
  src,
  label,
  active,
}: {
  src: string;
  label: string;
  active: boolean;
}) {
  const [useImg, setUseImg] = useState(true);

  const iconTone = active ? "opacity-100" : "opacity-75";

  return (
    <div className="flex flex-col items-center gap-0.5">
      {useImg ? (
        <img
          src={src}
          alt=""
          className={`w-5 h-5 ${iconTone}`}
          onError={() => setUseImg(false)}
        />
      ) : (
        // 1. fallback – jednoduchá vstavaná ikona (krúžok)
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border border-neutral-500 text-[10px] ${iconTone}`}
        >
          {label[0] ?? "·"}
        </span>
      )}

      {/* 2. fallback / label – text je vždy, aj keď je ikona OK */}
      <span
        className={`text-[11px] ${
          active ? "text-white" : "text-neutral-300"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function MobileBottomBar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        lg:hidden
        sticky bottom-0 z-40
        border-t border-neutral-800
        bg-neutral-950/95 backdrop-blur
        [padding-bottom:env(safe-area-inset-bottom)]
        h-16
      "
      aria-label="Dolná navigácia"
    >
      <div className="max-w-screen-md mx-auto h-full flex items-center justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname?.startsWith(item.href + "/") ?? false);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`
                flex-1 h-full flex items-center justify-center
              `}
            >
              <div
                className={`
                  inline-flex flex-col items-center justify-center gap-1
                  px-1
                  ${
                    isActive
                      ? "text-white"
                      : "text-neutral-400 hover:text-neutral-100"
                  }
                `}
              >
                <IconWithFallback
                  src={item.iconSrc}
                  label={item.label}
                  active={isActive}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}