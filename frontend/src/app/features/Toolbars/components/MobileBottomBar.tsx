// src/app/features/Toolbars/components/MobileBottomBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type ItemDef = {
  href: string;
  label: string;
  iconSrc?: string; // cesta do /public (napr. "/recoveryIcon.svg")
};

const ITEMS: ItemDef[] = [
  { href: "/activities", label: "Aktivity", iconSrc: "/activitiesIcon.svg" },
  { href: "/coach", label: "Coach", iconSrc: "/coachIcon.svg" },
  { href: "/profile", label: "Profil", iconSrc: "/profileIcon.svg" },
  { href: "/recovery", label: "Recovery", iconSrc: "/recoveryIcon.svg" },
  { href: "/calendar", label: "Kalendár", iconSrc: "/calendarIcon.svg" },
];

function BottomNavItem({ href, label, iconSrc }: ItemDef) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const [iconBroken, setIconBroken] = useState(false);

  const circleClass = [
    "flex items-center justify-center",
    "rounded-full mb-1",
    "w-9 h-9 border", // border = stroke
    isActive
      ? "bg-green-500 border-black" // aktívny: zelená výplň + čierny stroke
      : "bg-neutral-800 border-white/60", // neaktívny: šedá výplň + biely stroke
  ].join(" ");

  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center justify-center flex-1",
        "text-[11px] font-medium",
        "transition-colors",
        isActive ? "text-white" : "text-neutral-400",
      ].join(" ")}
    >
      <div className={circleClass}>
        {iconSrc && !iconBroken ? (
          <img
            src={iconSrc}
            alt={label}
            className="w-5 h-5"
            onError={() => setIconBroken(true)}
          />
        ) : (
          <span className="text-xs">
            {label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export default function MobileBottomBar() {
  return (
    <nav
      className={[
        "lg:hidden",
        "fixed bottom-0 inset-x-0 z-40",
        "border-t border-neutral-800",
        "bg-neutral-950/95 backdrop-blur",
        "h-20 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]",
      ].join(" ")}
      aria-label="Hlavná mobilná navigácia"
    >
      <div className="max-w-screen-sm mx-auto px-2 h-full flex items-stretch gap-1">
        {ITEMS.map((item) => (
          <BottomNavItem key={item.href} {...item} />
        ))}
      </div>
    </nav>
  );
}