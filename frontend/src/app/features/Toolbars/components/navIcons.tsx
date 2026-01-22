"use client";

import type { ReactNode } from "react";

const STROKE_WIDTH = 1.9;

export type NavId = "dashboard" | "activities" | "coach" | "profile" | "recovery" | "calendar";

export function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <path d="M10 3h4" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      <path d="M11 2h2" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      <circle cx={12} cy={13} r={6} stroke="currentColor" strokeWidth={STROKE_WIDTH} fill="none" />
      <path d="M12 13L15 11" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      <circle cx={12} cy={13} r={0.7} fill="currentColor" />
    </svg>
  );
}

export function CoachIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <path
        d="M10.09 1.5h3.83a2.87 2.87 0 0 1 2.87 2.87v4.78A4.78 4.78 0 0 1 12 13.93 4.78 4.78 0 0 1 7.22 9.15V4.37A2.87 2.87 0 0 1 10.09 1.5Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <path
        d="M7.22 5.33h9.57a2.87 2.87 0 0 1-2.88 2.87h-3.82A2.87 2.87 0 0 1 7.22 5.33Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <path
        d="M3.39 23.5v-1A8.62 8.62 0 0 1 12 13.93a8.62 8.62 0 0 1 8.61 8.61v1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeMiterlimit={10}
      />
      <circle cx={12} cy={20.63} r={0.96} stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeMiterlimit={10} />
      <line x1={12.96} y1={23.5} x2={12.96} y2={20.63} stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeMiterlimit={10} />
      <polyline points="7.22 13.94 12 19.67 16.78 13.94" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeMiterlimit={10} fill="none" />
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <circle cx={12} cy={8} r={2.6} stroke="currentColor" strokeWidth={STROKE_WIDTH} fill="none" />
      <path
        d="M6.5 19c.5-3.2 2.8-5.5 5.5-5.5s5 2.3 5.5 5.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecoveryIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <path
        d="M15.5 11.5H14.5L13 14.5L11 8.5L9.5 11.5H8.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.9932 5.13581C9.9938 2.7984 6.65975 2.16964 4.15469 4.31001C1.64964 6.45038 1.29697 10.029 3.2642 12.5604C4.75009 14.4724 8.97129 18.311 10.948 20.0749C11.3114 20.3991 11.4931 20.5613 11.7058 20.6251C11.8905 20.6805 12.0958 20.6805 12.2805 20.6251C12.4932 20.5613 12.6749 20.3991 13.0383 20.0749C15.015 18.311 19.2362 14.4724 20.7221 12.5604C22.6893 10.029 22.3797 6.42787 19.8316 4.31001C17.2835 2.19216 13.9925 2.7984 11.9932 5.13581Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <path
        d="M3 9H21M7 3V5M17 3V5M6 13H8M6 17H8M11 13H13M11 17H13M16 13H18M16 17H18M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// (optional) Dashboard icon – jednoduchý “grid”
export function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="none">
      <path
        d="M4.5 4.5h6v6h-6v-6Zm9 0h6v10h-6v-10ZM4.5 13.5h6v6h-6v-6Zm9 3h6v3h-6v-3Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavIcon({ id }: { id: NavId }): ReactNode {
  switch (id) {
    case "dashboard":
      return <DashboardIcon />;
    case "activities":
      return <ActivityIcon />;
    case "coach":
      return <CoachIcon />;
    case "profile":
      return <ProfileIcon />;
    case "recovery":
      return <RecoveryIcon />;
    case "calendar":
      return <CalendarIcon />;
    default:
      return null;
  }
}