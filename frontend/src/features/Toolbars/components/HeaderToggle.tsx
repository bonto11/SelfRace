'use client';

import { useSidebar } from '@/features/Toolbars/hooks/useSidebar';

export default function HeaderToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded hover:bg-neutral-800"
      aria-label="Toggle sidebar"
      title="Menu"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
