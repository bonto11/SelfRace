// src/features/auth/components/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

type AuthCtx = {
  user: User | null;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: { children: React.ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);

  // jednoduchý “refresh” z cookies cez náš serverový endpoint
  async function refresh() {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setUser(json?.user ?? null);
    } catch {
      // no-op
    }
  }

  // voliteľné: jemné oživenie pri návrate na tabu
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <Ctx.Provider value={{ user, setUser, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
