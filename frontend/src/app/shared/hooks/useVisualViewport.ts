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
export function useVisualViewport(): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const height = Math.round(vv.height);
      setState({
        height,
        offsetTop: Math.round(vv.offsetTop),
        keyboardOpen: height < window.innerHeight * 0.75,
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
