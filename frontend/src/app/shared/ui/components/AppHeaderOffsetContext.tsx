"use client";

import { createContext, useContext, type ReactNode } from "react";

// Výška globálnej hlavičky (logo + UserMenu) z ClientProtectedShell.tsx
// (header data-app-header, h-14 = 56px). Stránky pod protected layoutom
// potrebujú, aby ich vlastná AppHeader (fixed) začínala až POD touto
// globálnou hlavičkou. Stránky mimo protected layoutu (napr. (auth) skupina)
// žiadnu takú hlavičku nemajú, takže default je 0.
export const PROTECTED_GLOBAL_HEADER_HEIGHT_PX = 56;

const AppHeaderOffsetContext = createContext<number>(0);

export function AppHeaderOffsetProvider({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) {
  return (
    <AppHeaderOffsetContext.Provider value={value}>
      {children}
    </AppHeaderOffsetContext.Provider>
  );
}

export function useAppHeaderOffset(): number {
  return useContext(AppHeaderOffsetContext);
}