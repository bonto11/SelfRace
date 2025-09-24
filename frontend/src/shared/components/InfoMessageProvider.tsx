// src/shared/components/InfoMessageProvider.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import InfoMessage from "./InfoMessage";

type Kind = "info" | "success" | "error";

type Ctx = {
  show: (text: string, opts?: { kind?: Kind; durationMs?: number }) => void;
  close: () => void;
};

const InfoMessageCtx = createContext<Ctx | null>(null);

export default function InfoMessageProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: Kind } | null>(null);

  const close = useCallback(() => setMsg(null), []);
  const show = useCallback((text: string, opts?: { kind?: Kind; durationMs?: number }) => {
    setMsg({ text, kind: opts?.kind ?? "info" });
    const ms = opts?.durationMs ?? 3500;
    if (ms > 0) setTimeout(() => setMsg(null), ms);
  }, []);

  const value = useMemo<Ctx>(() => ({ show, close }), [show, close]);

  return (
    <InfoMessageCtx.Provider value={value}>
      {children}
      {msg && <InfoMessage text={msg.text} kind={msg.kind} onClose={close} />}
    </InfoMessageCtx.Provider>
  );
}

export function useInfoMessage(): Ctx {
  const ctx = useContext(InfoMessageCtx);
  if (!ctx) throw new Error("useInfoMessage must be used within <InfoMessageProvider>");
  return ctx;
}