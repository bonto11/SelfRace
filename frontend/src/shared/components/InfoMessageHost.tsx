// src/shared/components/InfoMessageHost.tsx
"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import InfoMessage, { type InfoKind } from "./InfoMessage";

type Msg = { id: string; text: string; kind: InfoKind };

type Ctx = {
  push: (text: string, kind?: InfoKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  clear: () => void;
};

export const InfoCtx = createContext<Ctx | null>(null);

export default function InfoMessageHost({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Msg[]>([]);

  const push = useCallback((text: string, kind: InfoKind = "info") => {
    const id = crypto.randomUUID?.() ?? String(Math.random());
    const m: Msg = { id, text, kind };
    setList((prev) => [...prev, m]);
    // auto-dismiss po 4s
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4000);
  }, []);

  const clear = useCallback(() => setList([]), []);

  const ctx = useMemo<Ctx>(() => ({
    push,
    success: (t) => push(t, "success"),
    error: (t) => push(t, "error"),
    clear,
  }), [push, clear]);

  return (
    <InfoCtx.Provider value={ctx}>
      {/* stack správ vpravo hore */}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
        {list.map((m) => (
          <div key={m.id} className="pointer-events-auto">
            <InfoMessage text={m.text} kind={m.kind} onClose={() => setList((l) => l.filter((x) => x.id !== m.id))} />
          </div>
        ))}
      </div>
      {children}
    </InfoCtx.Provider>
  );
}