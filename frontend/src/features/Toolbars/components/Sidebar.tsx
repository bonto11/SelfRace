// src/features/Toolbars/Sidebar.tsx
'use client';
import { useEffect, useRef } from 'react';
import { useSidebar } from '@/features/Toolbars/hooks/useSidebar';
import { useBodyScrollLock } from '@/features/Toolbars/hooks/useBodyScrollLock';
import NavLink from './NavLink';
import {
  SIDEBAR_OVERLAY,
  SIDEBAR_MOBILE_PANEL,
  SIDEBAR_DESKTOP,
  BRAND_TEXT,
} from '@/shared/ui/classes';

export default function Sidebar() {
  const { open, setOpen } = useSidebar();
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // focus po otvorení
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className={SIDEBAR_OVERLAY}
        />
      )}

      {/* Panel – mobilný off-canvas + desktop sidebar */}
      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label="Primary"
        aria-hidden={false}
        className={`${SIDEBAR_MOBILE_PANEL} ${SIDEBAR_DESKTOP}`}
        onClick={() => setOpen(false)} // zatvor po kliknutí v mobile
      >
        <div className="p-4 flex items-center justify-between border-b border-neutral-800">
          <div className={BRAND_TEXT}>SelfRace</div>

          {/* Close (mobile only) – ikonové tlačidlo */}
          <button
            className="lg:hidden rounded-lg p-2 border border-neutral-700 hover:bg-neutral-800"
            aria-label="Close menu"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          >
            ✕
          </button>
        </div>

        <ul className="space-y-1 px-2 pb-4 pt-2">
          <li><NavLink href="/dashboard" >Dashboard</NavLink></li>
          <li><NavLink href="/activities">Activities</NavLink></li>
          <li><NavLink href="/recovery"  >Recovery</NavLink></li>
          <li><NavLink href="/coach"     >AI Coach</NavLink></li>
          <li><NavLink href="/profile"   >Profile</NavLink></li>
        </ul>
      </nav>
    </>
  );
}