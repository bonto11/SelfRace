// src/features/Toolbars/components/HeaderToggle.tsx
'use client';
import { useSidebar } from '@/features/Toolbars/hooks/useSidebar';
import { HAMBURGER_BTN } from '@/shared/ui/classes';

export default function HeaderToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      className={HAMBURGER_BTN}
      aria-label="Open menu"
      title="Menu"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}