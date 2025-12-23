"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  Icon: (props: { active: boolean }) => JSX.Element;
};

const ITEMS: Item[] = [
  { href: "/activities", label: "Aktivity", Icon: ActivityIcon },
  { href: "/coach", label: "Coach", Icon: CoachIcon },
  { href: "/profile", label: "Profil", Icon: ProfileIcon },
  { href: "/recovery", label: "Recovery", Icon: RecoveryIcon },
  { href: "/calendar", label: "Kalendár", Icon: CalendarIcon },
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
      <ul className="flex h-16">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={[
                  "flex h-full flex-col items-center justify-center",
                  "border-r border-neutral-800 last:border-r-0",
                  active
                    ? "bg-neutral-800/85 text-white"
                    : "text-neutral-300 hover:bg-neutral-900",
                ].join(" ")}
              >
                <Icon active={active} />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ==== IKONY (jednoduché inline SVG, používajú currentColor) ==== */

function iconClass(active: boolean) {
  return [
    "w-6 h-6",
    active ? "opacity-100" : "opacity-70",
  ].join(" ");
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <path
        d="M4 17l4-9 4 8 3-6 5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 5h4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoachIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(active)}
      aria-hidden="true"
    >
      {/* chat bubble */}
      <path
        d="M5 5h14a2 2 0 012 2v6a2 2 0 01-2 2h-5l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* malá „hviezdička“ ako coach */}
      <path
        d="M12 9l.9 1.8 2 .3-1.5 1.4.4 2-1.8-.9-1.8.9.4-2L9.1 11l2-.3L12 9z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <circle
        cx={12}
        cy={8}
        r={3.2}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d="M5 19a7 7 0 0114 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RecoveryIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(active)}
      aria-hidden="true"
    >
      {/* heart */}
      <path
        d="M12 20s-4.5-3-7-5.8C3.3 13.3 3 12.5 3 11.5 3 9.6 4.6 8 6.5 8c1.2 0 2.3.6 3 1.6.7-1 1.8-1.6 3-1.6C14.4 8 16 9.6 16 11.5c0 1-.3 1.8-2 2.7-2.5 2.8-7 5.8-7 5.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* malý „pulse“ */}
      <path
        d="M7 12h2l1 2 2-4 1 2h4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <rect
        x={4}
        y={5}
        width={16}
        height={15}
        rx={2}
        ry={2}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <path
        d="M4 9h16"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M9 4v4M15 4v4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* zvýraznený deň */}
      <rect x={8} y={11} width={4} height={4} rx={1} fill="currentColor" />
    </svg>
  );
}