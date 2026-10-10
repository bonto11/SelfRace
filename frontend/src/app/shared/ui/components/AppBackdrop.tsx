"use client";

import { useState, useEffect, type ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

/**
 * Vrstvy pozadia appky. Zdieľa ich aj fixná hlavička stránky (AppHeader),
 * ktorá si pod seba kreslí presne ten istý výrez – posúvaný obsah tak pod
 * ňou nepresvitá a hlavička pritom vyzerá rovnako ako pozadie okolo.
 */
export function appBackdropBase(isBypass = false): string {
  return isBypass
    ? "#FEEA3D" // Čistá žltá farba pre Maintenance Bypass
    : `radial-gradient(900px 500px at 50% 20%, rgba(74,222,128,0.10), transparent 60%),
       radial-gradient(700px 420px at 20% 80%, rgba(45,212,191,0.08), transparent 60%),
       linear-gradient(180deg, ${appColors.backgroundMain}, ${appColors.backgroundAlt})`; // Klasika
}

export const APP_BACKDROP_OVERLAY = "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.55))";

export default function AppBackdrop({ children }: { children?: ReactNode }) {
  const [isBypass, setIsBypass] = useState(false);

  useEffect(() => {
    // Ak sa načíta komponent, pozrie sa, či nám middleware neposlal cookie
    if (typeof document !== "undefined") {
      if (document.cookie.includes("admin_maintenance_bypass=true")) {
        setIsBypass(true);
      }
    }
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      {/* pozadie */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{ background: appBackdropBase(isBypass) }}
      />
      
      {/* stmavovacia vrstva - pri bypasse ju môžeme trochu potlačiť, nech tá žltá dobre vynikne */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: APP_BACKDROP_OVERLAY,
          opacity: isBypass ? 0.3 : 1
        }}
      />

      {/* obsah */}
      <div className="relative z-10" style={{ color: appColors.textPrimary }}>
        {children}
      </div>
    </div>
  );
}