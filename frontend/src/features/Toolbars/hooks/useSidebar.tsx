'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type Ctx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const SidebarCtx = createContext<Ctx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarCtx.Provider value={{ open, setOpen, toggle: () => setOpen(v => !v) }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export const useSidebar = () => {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error('useSidebar must be used inside <SidebarProvider>');
  return ctx;
};
