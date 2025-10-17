// src/features/auth/components/UserIdProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Ctx = {
  userUuid: string | null;
  userId: number | null;
  refresh: () => void;
};

const UserIdContext = createContext<Ctx | null>(null);

export function UserIdProvider({ children }: { children: React.ReactNode }) {
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const load = () => {
    const u = document.cookie.match(/(?:^|;\s*)sr_uuid=([^;]+)/);
    const id = document.cookie.match(/(?:^|;\s*)sr_id=([^;]+)/);

    setUserUuid(u ? decodeURIComponent(u[1]) : null);
    const parsed = id ? Number(decodeURIComponent(id[1])) : null;
    setUserId(Number.isFinite(parsed) ? parsed : null);
  };

  useEffect(load, []);

  const value = useMemo(() => ({ userUuid, userId, refresh: load }), [userUuid, userId]);

  return <UserIdContext.Provider value={value}>{children}</UserIdContext.Provider>;
}

export function useUserIdContext() {
  const ctx = useContext(UserIdContext);
  if (!ctx) throw new Error("useUserIdContext must be used inside <UserIdProvider>");
  return ctx;
}
