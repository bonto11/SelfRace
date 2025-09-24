// src/shared/hooks/useInfoMessage.ts
// Malý stateful hook na správu toastu v rámci jednej stránky/komponentu.
// Vráti aktuálny toast a helpery show/hide.

"use client";

import { useState } from "react";
import type { InfoMessageKind } from "@/shared/components/InfoMessage"; // ak nechceš aliasy, nechaj relatívne

export type InfoMessageState = { msg: string; kind?: InfoMessageKind } | null;

export function useInfoMessage() {
  const [InfoMessage, setInfoMessage] = useState<InfoMessageState>(null);

  function showInfoMessage(msg: string, kind: InfoMessageKind = "info") {
    setInfoMessage({ msg, kind });
  }
  function hideInfoMessage() {
    setInfoMessage(null);
  }

  return { InfoMessage, showInfoMessage, hideInfoMessage };
}