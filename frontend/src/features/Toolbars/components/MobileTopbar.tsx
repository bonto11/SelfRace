// src/features/Toolbars/components/MobileTopbar.tsx
'use client';
import { useSidebar } from '@/features/Toolbars/hooks/useSidebar';
import {
  TOPBAR_MOBILE,
  ICON_BUTTON,
  SIDEBAR_OVERLAY,
  SIDEBAR_MOBILE_PANEL,
  BRAND_TEXT,
} from '@/shared/ui/classes';

export default function MobileTopbar({ title = 'Trainalyze' }: { title?: string }) {
  const { open, toggle, setOpen } = useSidebar();

  return (
    <>
      {/* topbar – iba na mobile */}
      <div className={TOPBAR_MOBILE}>
        <button
          onClick={toggle}
          aria-label="Menu"
          className={ICON_BUTTON}
        >
          ☰
        </button>
        <div className={BRAND_TEXT}>{title}</div>
      </div>

      {/* overlay + off-canvas */}
      {open && (
        <>
          <button
            className={SIDEBAR_OVERLAY}
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <nav
            className={SIDEBAR_MOBILE_PANEL}
            aria-label="Primary"
            onClick={() => setOpen(false)}
          >
            {/* Tu vlož komponent Sidebar alebo jeho obsah */}
          </nav>
        </>
      )}
    </>
  );
}