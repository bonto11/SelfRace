// src/app/shared/ui/components/OutageBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { alpha } from "@/app/shared/ui/theme/colorUtils";
import { useT } from "@/app/shared/i18n/useT";
import { OUTAGE_BANNER } from "@/app/shared/config";

const STORAGE_KEY = "sr:outage-banner:dismissed";

/**
 * Oznam o výpadku (AI a notifikácie). Zapína sa len env premennou na Verceli
 * (NEXT_PUBLIC_OUTAGE_BANNER=true) - PREČO nie z BE: pri výpadku hostingu BE
 * nejde nasadiť ani mu zmeniť nastavenie, FE áno. Vypnutie = false + redeploy.
 * Zatvorenie platí do zatvorenia appky (sessionStorage), potom sa ukáže znova.
 */
export default function OutageBanner() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!OUTAGE_BANNER) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // bez storage sa ukáže vždy
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // nič
    }
  };

  return (
    <div
      role="status"
      className="fixed left-3 right-3 lg:left-auto lg:right-6 lg:max-w-md bottom-[calc(env(safe-area-inset-bottom)+104px)] lg:bottom-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg"
      style={{
        zIndex: 40,
        background: appColors.surfaceSolid,
        border: `1px solid ${alpha(appColors.statusWarning, 0.6)}`,
        color: appColors.textPrimary,
      }}
    >
      <span aria-hidden className="text-base leading-5">⚠️</span>
      <div className="flex-1">
        <div className="font-semibold" style={{ color: appColors.statusWarning }}>
          {t("outageBanner.title")}
        </div>
        <div className="mt-0.5" style={{ color: appColors.textMuted }}>
          {t("outageBanner.text")}
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={t("outageBanner.close")}
        title={t("outageBanner.close")}
        className="shrink-0 leading-5 px-1"
        style={{ color: appColors.textMuted }}
      >
        ✕
      </button>
    </div>
  );
}
