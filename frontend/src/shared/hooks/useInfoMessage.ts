// src/shared/hooks/useInfoMessage.ts
"use client";
import { useContext } from "react";
import { InfoCtx } from "@/shared/components/InfoMessageHost";

export default function useInfoMessage() {
  const ctx = useContext(InfoCtx);
  if (!ctx) throw new Error("useInfoMessage must be used inside <InfoMessageHost>");
  return ctx;
}