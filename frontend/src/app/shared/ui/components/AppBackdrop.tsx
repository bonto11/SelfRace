"use client";

import { useState, useEffect, type ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function AppBackdrop({ children }: { children?: ReactNode }) {
  const [isBypass, setIsBypass] = useState(false);

  useEffect(() => {
    // Ak sa načíta komponent, pozrie sa, či nám middleware neposlal cookie
    if (typeof document !== "undefined") {
      console.log("🍪 Aktuálne cookies:", document.cookie);
      if (document.cookie.includes("admin_maintenance_bypass=true")) {
        console.log("🚧 ADMIN BYPASS DETEGOVANÝ - Mením farbu pozadia!");
        setIsBypass(true);
      }
    }
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* pozadie */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: isBypass
            ? `radial-gradient(900px 500px at 50% 20%, rgba(255,255,0,0.15), transparent 60%),
               radial-gradient(700px 420px at 20% 80%, rgba(255,200,0,0.12), transparent 60%),
               linear-gradient(180deg, #2b2100, #140f00)` // Tmavo žltá/zlatá výstraha
            : `radial-gradient(900px 500px at 50% 20%, rgba(74,222,128,0.10), transparent 60%),
               radial-gradient(700px 420px at 20% 80%, rgba(45,212,191,0.08), transparent 60%),
               linear-gradient(180deg, ${appColors.backgroundMain}, ${appColors.backgroundAlt})`, // Klasika
        }}
      />
      
      {/* stmavovacia vrstva - pri bypasse znížime jej silu (opacity: 0.3), aby lepšie vynikla žltá */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.55))",
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
