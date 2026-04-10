// src/app/shared/components/ui/AppBackdrop.tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function AppBackdrop({ children }: { children?: ReactNode }) {
  // 👇 Kontrola, či sme v Maintenance režime ako Admin
  const [isBypass, setIsBypass] = useState(false);

  useEffect(() => {
    if (document.cookie.includes("admin_maintenance_bypass=true")) {
      setIsBypass(true);
    }
  }, []);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* pozadie */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: isBypass
            ? `radial-gradient(900px 500px at 50% 20%, rgba(234,179,8,0.15), transparent 60%),
               radial-gradient(700px 420px at 20% 80%, rgba(202,138,4,0.10), transparent 60%),
               linear-gradient(180deg, #3f2f00, #1a1300)` // Tmavo zlato-žlté gradienty
            : `radial-gradient(900px 500px at 50% 20%, rgba(74,222,128,0.10), transparent 60%),
               radial-gradient(700px 420px at 20% 80%, rgba(45,212,191,0.08), transparent 60%),
               linear-gradient(180deg, ${appColors.backgroundMain}, ${appColors.backgroundAlt})`, // Tvoje klasické farby
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.55))",
        }}
      />

      {/* obsah */}
      <div className="relative z-10" style={{ color: appColors.textPrimary }}>
        {children}
      </div>
    </div>
  );
}
