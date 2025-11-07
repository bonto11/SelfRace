// src/features/Toolbars/hooks/useSidebar.ts
import { create } from "zustand";

type SidebarState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

export const useSidebar = create<SidebarState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set((s) => ({ open: !s.open })),
}));