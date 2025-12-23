"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavId = "activities" | "coach" | "profile" | "recovery" | "calendar";

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

// ---------- IKONY ----------

function ActivityIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20.75 4.5C20.75 5.88071 19.6307 7 18.25 7C16.8693 7 15.75 5.88071 15.75 4.5C15.75 3.11929 16.8693 2 18.25 2C19.6307 2 20.75 3.11929 20.75 4.5Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.80218 5.93063C10.0117 5.9017 10.2599 5.87536 10.523 5.88702C10.603 5.89057 10.6938 5.89706 10.7962 5.90769C13.1789 6.155 14.9468 7.94323 16.1242 9.70933L16.1866 9.80281C16.7893 10.7069 17.8041 11.25 18.8907 11.25H20.75C21.1642 11.25 21.5 11.5858 21.5 12C21.5 12.4142 21.1642 12.75 20.75 12.75H18.8907C17.3025 12.75 15.8195 11.9563 14.9385 10.6349L14.8762 10.5414C14.6037 10.1327 14.311 9.74468 13.9989 9.38944L12.1149 11.7441C11.6875 12.2783 11.4008 12.6379 11.2076 12.9334C11.0204 13.2196 10.967 13.3792 10.9528 13.5003C10.9293 13.7003 10.9546 13.903 11.0263 14.0911C11.0698 14.2051 11.1607 14.3467 11.4123 14.5783C11.6721 14.8173 12.0382 15.0957 12.5835 15.5088C12.6157 15.5332 12.6475 15.5573 12.6789 15.5811C13.3998 16.1267 13.8989 16.5046 14.2444 17.0094C14.4408 17.2964 14.5963 17.6093 14.7065 17.9392C14.9002 18.5194 14.9 19.1454 14.8996 20.0495C14.8996 20.0888 14.8996 20.1287 14.8996 20.1692V22C14.8996 22.4142 14.5638 22.75 14.1496 22.75C13.7354 22.75 13.3996 22.4142 13.3996 22V20.1692C13.3996 19.0986 13.3905 18.7342 13.2837 18.4143C13.2176 18.2164 13.1243 18.0287 13.0065 17.8565C12.8161 17.5782 12.531 17.3509 11.6777 16.7045L11.6488 16.6826C11.1398 16.2969 10.7155 15.9755 10.3965 15.682C10.0635 15.3754 9.7855 15.0471 9.62475 14.6256C9.46691 14.2116 9.4114 13.7657 9.46296 13.3257C9.51547 12.8776 9.70447 12.4912 9.95221 12.1124C10.1895 11.7496 10.522 11.3339 10.9211 10.8353L12.9047 8.35598C12.2175 7.83323 11.4608 7.48473 10.6414 7.39967C10.5672 7.39198 10.5059 7.38774 10.4565 7.38555C10.3286 7.37988 10.1855 7.39194 10.0074 7.41653C8.94204 7.56364 7.87451 8.15548 5.55619 9.47271L4.12051 10.2884C3.76037 10.4931 3.30253 10.367 3.09791 10.0069C2.89328 9.64671 3.01935 9.18888 3.37949 8.98426L4.81517 8.16853C4.86639 8.13943 4.91715 8.11058 4.96746 8.08199C7.08653 6.87764 8.416 6.12205 9.80218 5.93063ZM9.23014 16.4238C9.54835 16.689 9.59134 17.1619 9.32617 17.4801L8.3254 18.6811C8.2928 18.7202 8.26067 18.7588 8.22895 18.7969C7.58688 19.5685 7.11555 20.135 6.45757 20.4432C5.79959 20.7513 5.0627 20.7508 4.05888 20.7501C4.00928 20.75 3.95904 20.75 3.90813 20.75H2.75C2.33579 20.75 2 20.4142 2 20C2 19.5858 2.33579 19.25 2.75 19.25H3.90813C5.12975 19.25 5.50396 19.2334 5.82133 19.0848C6.1387 18.9361 6.391 18.6593 7.17306 17.7208L8.17383 16.5199C8.43901 16.2017 8.91193 16.1587 9.23014 16.4238Z"
        fill={color}
      />
    </svg>
  );
}

function CoachIcon({ active }: { active: boolean }) {
  const stroke = active ? "#000000" : "#ffffff";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M10.09 1.5h3.83a2.87 2.87 0 0 1 2.87 2.87v4.78A4.78 4.78 0 0 1 12 13.93h0A4.78 4.78 0 0 1 7.22 9.15V4.37A2.87 2.87 0 0 1 10.09 1.5Z"
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
      />
      <path
        d="M7.22 5.33h9.57A2.87 2.87 0 0 1 13.91 8.2h-3.82A2.87 2.87 0 0 1 7.22 5.33Z"
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
      />
      <path
        d="M3.39 23.5v-1A8.62 8.62 0 0 1 12 13.93h0a8.62 8.62 0 0 1 8.61 8.61v1"
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
      />
      <circle
        cx={12}
        cy={20.63}
        r={0.96}
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
      />
      <line
        x1={12.96}
        y1={23.5}
        x2={12.96}
        y2={20.63}
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
      />
      <polyline
        points="7.22 13.94 12 19.67 16.78 13.94"
        stroke={stroke}
        strokeWidth={1.9}
        strokeMiterlimit={10}
        fill="none"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M14 10c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4Zm3.758.673A5.99 5.99 0 0 0 18 6c0-3.314-2.686-6-6-6S6 2.686 6 6a5.99 5.99 0 0 0 2.242 4.673C4.583 12.048 2 15.445 2 20h2c0-5 3.589-8 8-8s8 3 8 8h2c0-4.555-2.583-7.952-6.242-9.327Z"
        fill={color}
      />
    </svg>
  );
}

function RecoveryIcon({ active }: { active: boolean }) {
  const stroke = active ? "#000000" : "#ffffff";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M15.5 11.5H14.5L13 14.5L11 8.5L9.5 11.5H8.5"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.9932 5.13581C9.9938 2.7984 6.65975 2.16964 4.15469 4.31001C1.64964 6.45038 1.29697 10.029 3.2642 12.5604C4.75009 14.4724 8.97129 18.311 10.948 20.0749C11.3114 20.3991 11.4931 20.5613 11.7058 20.6251C11.8905 20.6805 12.0958 20.6805 12.2805 20.6251C12.4932 20.5613 12.6749 20.3991 13.0383 20.0749C15.015 18.311 19.2362 14.4724 20.7221 12.5604C22.6893 10.029 22.3797 6.42787 19.8316 4.31001C17.2835 2.19216 13.9925 2.7984 11.9932 5.13581Z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  const stroke = active ? "#000000" : "#ffffff";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M3 9H21M7 3V5M17 3V5M6 13H8M6 17H8M11 13H13M11 17H13M16 13H18M16 17H18M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Icon({ id, active }: { id: NavId; active: boolean }) {
  switch (id) {
    case "activities":
      return <ActivityIcon active={active} />;
    case "coach":
      return <CoachIcon active={active} />;
    case "profile":
      return <ProfileIcon active={active} />;
    case "recovery":
      return <RecoveryIcon active={active} />;
    case "calendar":
      return <CalendarIcon active={active} />;
    default:
      return null;
  }
}

// ---------- ITEM + BAR ----------

function BottomNavItem({ id, href, label }: ItemDef) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center justify-center flex-1",
        "text-[11px] font-medium transition-colors",
        isActive ? "text-white" : "text-neutral-400",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center justify-center rounded-full mb-1 w-10 h-10 border",
          isActive
            ? "bg-emerald-400 border-black"
            : "bg-neutral-700 border-white/70",
        ].join(" ")}
      >
        <Icon id={id} active={isActive} />
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
          <BottomNavItem key={item.id} {...item} />
        ))}
      </div>
    </nav>
  );
}