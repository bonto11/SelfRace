// src/features/Toolbars/Sidebar.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSidebar } from "@/app/features/Toolbars/hooks/useSidebar";
import { useBodyScrollLock } from "@/app/features/Toolbars/hooks/useBodyScrollLock";
import NavLink from "./NavLink";
import { appColors } from "@/app/shared/theme/app_colors";

export default function Sidebar() {
  const { open, setOpen } = useSidebar();
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {open && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[50] lg:hidden"
          style={{ background: appColors.overlay }}
        />
      )}

      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label="Primary"
        className={[
          "fixed inset-y-0 left-0 w-[280px]",
          "transform transition-transform duration-200 will-change-transform",
          "z-[55]",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:h-dvh lg:translate-x-0",
        ].join(" ")}
        style={{
          background: appColors.backgroundAlt,
          color: appColors.textPrimary,
          borderRight: `1px solid ${appColors.divider}`,
        }}
      >
        <div className="p-4 flex items-center justify-between">

          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            style={{
              border: `1px solid ${appColors.surfaceCardBorder}`,
              background: appColors.buttonGhostBg,
              color: appColors.textPrimary,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                appColors.buttonGhostBgHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                appColors.buttonGhostBg;
            }}
          >
            ✕
          </button>
        </div>

        <ul className="space-y-1 px-2 pb-4" onClick={() => setOpen(false)}>
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