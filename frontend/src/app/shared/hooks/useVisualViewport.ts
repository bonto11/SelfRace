// src/app/shared/hooks/useVisualViewport.ts
"use client";

import { useEffect, useState } from "react";

export type VisualViewportState = {
  /** Výška reálne viditeľnej časti obrazovky (bez klávesnice). */
  height: number;
  /** O koľko iOS posunul stránku pri otvorení klávesnice. */
  offsetTop: number;
  /** Klávesnica je otvorená - viditeľná časť je výrazne menšia ako okno. */
  keyboardOpen: boolean;
};

/**
 * Viditeľná časť obrazovky.
 *
 * PREČO: na iOS klávesnica nezmenšuje layout (100vh ani 100dvh sa
 * nezmenia), len prekryje spodok stránky. Modal s max-h-[85dvh] si preto
 * myslí, že má celú výšku, a jeho spodok - aj s poľom, do ktorého
 * píšeš - ostane pod klávesnicou. visualViewport hovorí, koľko je
 * reálne vidieť.
 *
 * null = prehliadač visualViewport nepodporuje (vtedy platí CSS fallback).
 */
const TEXT_INPUT_TYPES = new Set(["", "text", "number", "search", "email", "tel", "url", "password"]);

/** Pole, pri ktorom iOS otvára klávesnicu (nie dátum, výber, checkbox). */
function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has((el.type || "").toLowerCase());
  return (el as HTMLElement).isContentEditable === true;
}

export function useVisualViewport(): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const height = Math.round(vv.height);
      const shrunk = height < window.innerHeight * 0.75;
      // PREČO: iOS zmenší viditeľnú časť aj pri výbere dátumu (koliesko) a po
      // jeho zatvorení ju niekedy nechá zmenšenú - modal sa potom zrútil na
      // hlavičku a tlačidlá. Za klávesnicu rátame len písanie do textu.
      if (shrunk && !isTextEntry(document.activeElement)) {
        setState({ height: window.innerHeight, offsetTop: 0, keyboardOpen: false });
        return;
      }
      setState({
        height,
        offsetTop: Math.round(vv.offsetTop),
        keyboardOpen: shrunk,
      });
    };

    // focus/blur zmení aj to, či ide o písanie - prepočítaj aj bez resize
    const onFocusChange = () => window.setTimeout(update, 50);

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
    };
  }, []);

  return state;
}
