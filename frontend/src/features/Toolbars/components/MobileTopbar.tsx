// src/features/Toolbars/MobileTopbar.tsx
"use client";

import { useSidebar } from "@/features/Toolbars/hooks/useSidebar";

export default function MobileTopbar({
  title = "Trainalyze",
}: {
  title?: string;
}) {
  const { open, toggle, setOpen } = useSidebar();

  return (
    <>
      {/* topbar – iba mobil */}
      <div className="lg:hidden sticky top-0 z-[58] flex items-center gap-3 bg-neutral-950/90 backdrop-blur px-3 py-2 border-b border-neutral-800">
        <button
          type="button"
          onClick={toggle}
          aria-label="Menu"
          className="rounded-lg p-2 border border-neutral-700 hover:bg-neutral-800"
        >
          ☰
        </button>
        <div className="font-semibold text-neutral-200">{title}</div>
      </div>

      {/* overlay + off-canvas */}
      {open && (
        <>
          <button
            aria-label="Close menu overlay"
            className="lg:hidden fixed inset-0 z-[50] bg-black/50"
            onClick={() => setOpen(false)}
          />
          {/* Panel samotný renderuje Sidebar.tsx (nižšie) */}
        </>
      )}
    </>
  );
}