// src/app/features/Toolbars/components/MobileBottomBar.tsx
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

// ---------- IKONY – jednotný štýl ----------

const STROKE_WIDTH = 1.9;

function ActivityIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";

  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden="true"
      fill="none"
    >
      <circle
        cx={8}
        cy={7}
        r={2.6}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      <path
        d="M8.3 9.9L11.2 12.1"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d="M11.2 12.1L15 14.7"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d="M11.2 12.1L9 16.4"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d="M8.9 9.6L12.3 10.5"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d="M6.1 9.8L8.4 11.3"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoachIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";

  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M10.09 1.5h3.83a2.87 2.87 0 0 1 2.87 2.87v4.78A4.78 4.78 0 0 1 12 13.93 4.78 4.78 0 0 1 7.22 9.15V4.37A2.87 2.87 0 0 1 10.09 1.5Z"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <path
        d="M7.22 5.33h9.57a2.87 2.87 0 0 1-2.88 2.87h-3.82A2.87 2.87 0 0 1 7.22 5.33Z"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <path
        d="M3.39 23.5v-1A8.62 8.62 0 0 1 12 13.93a8.62 8.62 0 0 1 8.61 8.61v1"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <circle
        cx={12}
        cy={20.63}
        r={0.96}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <line
        x1={12.96}
        y1={23.5}
        x2={12.96}
        y2={20.63}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <polyline
        points="7.22 13.94 12 19.67 16.78 13.94"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
        fill="none"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";

  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      fill="none"
    >
      <circle
        cx={12}
        cy={8}
        r={2.6}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      <path
        d="M6.5 19c.5-3.2 2.8-5.5 5.5-5.5s5 2.3 5.5 5.5"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecoveryIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";

  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M15.5 11.5H14.5L13 14.5L11 8.5L9.5 11.5H8.5"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.9932 5.13581C9.9938 2.7984 6.65975 2.16964 4.15469 4.31001C1.64964 6.45038 1.29697 10.029 3.2642 12.5604C4.75009 14.4724 8.97129 18.311 10.948 20.0749C11.3114 20.3991 11.4931 20.5613 11.7058 20.6251C11.8905 20.6805 12.0958 20.6805 12.2805 20.6251C12.4932 20.5613 12.6749 20.3991 13.0383 20.0749C15.015 18.311 19.2362 14.4724 20.7221 12.5604C22.6893 10.029 22.3797 6.42787 19.8316 4.31001C17.2835 2.19216 13.9925 2.7984 11.9932 5.13581Z"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  const color = active ? "#000000" : "#ffffff";

  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M3 9H21M7 3V5M17 3V5M6 13H8M6 17H8M11 13H13M11 17H13M16 13H18M16 17H18M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
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
      className="flex-1 flex justify-center min-w-0"
      aria-label={label}
    >
      <div className="flex flex-col items-center justify-center min-w-[60px]">
        <div
          className={[
            "flex items-center justify-center rounded-2xl w-[70px] h-9",
            "transition-colors",
            isActive ? "bg-emerald-400 text-black" : "bg-transparent text-white",
          ].join(" ")}
        >
          <Icon id={id} active={isActive} />
        </div>
        <span
          className={[
            "mt-1 text-[11px] leading-none truncate",
            isActive ? "text-white" : "text-neutral-300",
          ].join(" ")}
        >
          {label}
        </span>
      </div>
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
        {/* HLAVNÁ PILULA – užšia + mierne vyššie (mb-[3px]) */}
        <div className="mb-[3px] flex items-center gap-2 px-[9px] py-2 rounded-full bg-slate-950/92 border border-slate-700/70 backdrop-blur-sm shadow-lg">
          {ITEMS.map((item) => (
            <BottomNavItem key={item.id} {...item} />
          ))}
        </div>
      </div>
    </nav>
  );
}