"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = { appUserId: number | null; loading: boolean; error: string | null };
const AppUserCtx = createContext<Ctx>({ appUserId: null, loading: true, error: null });

export function UserIdProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx>({ appUserId: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/me/bootstrap", { credentials: "include" });
        const json = await res.json();
        if (!alive) return;
        setState({ appUserId: json?.userId ?? null, loading: false, error: null });
      } catch (e: any) {
        if (!alive) return;
        setState({ appUserId: null, loading: false, error: e?.message ?? "bootstrap_error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  return <AppUserCtx.Provider value={state}>{children}</AppUserCtx.Provider>;
}

export function useAppUser() {
  return useContext(AppUserCtx);
}