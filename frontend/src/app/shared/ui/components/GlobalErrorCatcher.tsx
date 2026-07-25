// src/app/shared/ui/components/GlobalErrorCatcher.tsx
"use client";

import * as React from "react";

/**
 * Zachytáva VŠETKY JS chyby v appke - vrátane tých, ktoré React Error
 * Boundary NEDOKÁŽE zachytiť (chyby v useEffect, v async kóde, v event
 * handleroch, unhandled promise rejections). Zobrazí ich priamo na
 * obrazovke ako červený banner, aby sme videli presnú chybu bez
 * potreby DevTools/remote debug na mobile.
 *
 * Toto je DIAGNOSTICKÝ nástroj - po nájdení skutočnej príčiny sa dá
 * odstrániť alebo ponechať ako trvalá poistka.
 */
export default function GlobalErrorCatcher() {
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
      setErrors((prev) => [...prev.slice(-4), msg]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? `${event.reason.name}: ${event.reason.message}\n${event.reason.stack ?? ""}`
          : String(event.reason);
      setErrors((prev) => [...prev.slice(-4), `[Unhandled Promise] ${reason}`]);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (errors.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#7f1d1d",
        color: "white",
        padding: 12,
        fontSize: 11,
        fontFamily: "monospace",
        maxHeight: "50vh",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        🔴 {errors.length} JS chyba/y zachytená/é:
      </div>
      {errors.map((e, i) => (
        <div key={i} style={{ marginBottom: 8, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 6 }}>
          {e}
        </div>
      ))}
    </div>
  );
}
