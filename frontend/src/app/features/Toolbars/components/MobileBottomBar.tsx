// src/features/Toolbars/MobileBottomBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/activities", label: "Aktivity" },
  { href: "/coach", label: "Coach" },
  { href: "/recovery", label: "Recovery" },
  // { href: "/profile", label: "Profil" }, // môžeš pridať neskôr
];

export default function MobileBottomBar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        lg:hidden
        fixed bottom-0 inset-x-0 z-[60]
        border-t border-neutral-800
        bg-neutral-950/95 backdrop-blur
        pb-[env(safe-area-inset-bottom)]
      "
      aria-label="Hlavná spodná navigácia"
    >
      <div className="flex h-14 items-stretch justify-around">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex-1 flex flex-col items-center justify-center text-xs",
                "transition-colors",
                active
                  ? "font-semibold text-sky-400"
                  : "text-neutral-300"
              ].join(" ")}
            >
              {/* neskôr môžeš doplniť ikonky */}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}