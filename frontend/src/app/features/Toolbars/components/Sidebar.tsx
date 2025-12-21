// src/features/Toolbars/Sidebar.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSidebar } from "@/app/features/Toolbars/hooks/useSidebar";
import { useBodyScrollLock } from "@/app/features/Toolbars/hooks/useBodyScrollLock";
import NavLink from "./NavLink";

export default function Sidebar() {
  const { open, setOpen } = useSidebar();
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // focus panel po otvorení
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
          className="fixed inset-0 z-[50] bg-black/50 lg:hidden"
        />
      )}

      {/* Panel */}
      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label="Primary"
        className={[
          "fixed inset-y-0 left-0 w-[280px]",
          "bg-neutral-900 text-neutral-100",
          "transform transition-transform duration-200 will-change-transform",
          "z-[55]",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:h-dvh lg:border-r lg:border-neutral-800 lg:translate-x-0",
        ].join(" ")}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="font-bold">SelfRace</div>
          {/* Close (mobile) */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded hover:bg-neutral-800"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <ul
          className="space-y-1 px-2 pb-4"
          onClick={() => setOpen(false)} // zatvára len pri kliknutí na link
        >
          <li>
            <NavLink href="/dashboard">Dashboard</NavLink>
          </li>
          <li>
            <NavLink href="/activities">Activities</NavLink>
          </li>
          <li>
            <NavLink href="/recovery">Recovery</NavLink>
          </li>
          <li>
            <NavLink href="/coach">AI Coach</NavLink>
          </li>
          <li>
            <NavLink href="/profile">Profile</NavLink>
          </li>
        </ul>
      </nav>
    </>
  );
}