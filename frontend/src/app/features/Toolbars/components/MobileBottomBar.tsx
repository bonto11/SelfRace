"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
};

// poradie podľa tvojho zadania: Aktivity, Coach, Profil, Recovery, Kalendár
const ITEMS: Item[] = [
  { href: "/activities", label: "Aktivity" },
  { href: "/coach", label: "Coach" },
  { href: "/profile", label: "Profil" },
  { href: "/recovery", label: "Recovery" },
  { href: "/calendar", label: "Kalendár" },
];

export default function MobileBottomBar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-[60]
        border-t border-neutral-800
        bg-neutral-950/95 backdrop-blur-md
        lg:hidden
        [padding-bottom:env(safe-area-inset-bottom)]
      "
      aria-label="Hlavná navigácia"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={[
                  "flex flex-col items-center justify-center gap-0.5",
                  "py-2 text-xs",
                  "border-r border-neutral-800 last:border-r-0",
                  active
                    ? "bg-neutral-800/80 text-white"
                    : "text-neutral-300 hover:bg-neutral-900",
                ].join(" ")}
              >
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}