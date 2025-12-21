// src/features/Toolbars/HeaderToggle.tsx
"use client";

import { useSidebar } from "@/features/Toolbars/hooks/useSidebar";

export default function HeaderToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded hover:bg-neutral-800 -ml-2 relative z-[60]"
      aria-label="Open menu"
      title="Menu"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}