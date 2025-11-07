"use client";

import { create } from "zustand";
import type { ReactNode } from "react";

type SidebarState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

/**
 * Globálny stav sidebaru (desktop aj mobile).
 * - bez Contextu (zustand)
 * - kompatibilný "Provider" je len no-op wrapper, aby si nemusel meniť Shell.
 */
export const useSidebar = create<SidebarState>((set, get) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
}));

/** No-op provider pre spätnú kompatibilitu so Shellom. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  return children as any;
}