// src/app/shared/ui/components/InAppBrowserBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser, tryAndroidIntentRedirect } from "@/app/shared/utils/inAppBrowser";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

const STORAGE_KEY = "sr_inapp_banner_dismissed_at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 6; // 6 hodín — nezobrazuj znova hneď

function wasRecentlyDismissed(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export default function InAppBrowserBanner() {
  const t = useT();
  const [info, setInfo] = useState<ReturnType<typeof detectInAppBrowser> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser();
    setInfo(detected);

    if (!detected.isInApp) return;
    if (wasRecentlyDismissed()) return;

    if (detected.isAndroid) {
      // Android: skús priamy redirect. Ak by zlyhal (napr. nie je Chrome), banner
      // ostane ako fallback, ale vo väčšine prípadov used nikdy neuvidí banner —
      // presmerovanie prebehne okamžite.
      const redirected = tryAndroidIntentRedirect();
      if (redirected) return;
    }

    setVisible(true);
  }, []);

  if (!visible || !info?.isInApp) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: appColors.backgroundAlt,
          borderTop: `1px solid ${appColors.panelBorder}`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: appColors.textPrimary }}>
            {t("inAppBrowser.title" as any)}
          </div>
          <button
            onClick={dismiss}
            aria-label={t("common.close" as any)}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              border: `1px solid ${appColors.panelBorder}`,
              background: "rgba(255,255,255,0.06)",
              color: appColors.textPrimary,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: appColors.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          {t("inAppBrowser.desc" as any).replace("{{app}}", info.appName || "")}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${appColors.panelBorder}`,
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>
            {info.isIOS ? "︙" : "⋮"}
          </span>
          <span style={{ fontSize: 13, color: appColors.textPrimary, lineHeight: 1.4 }}>
            {info.isIOS
              ? t("inAppBrowser.stepsIOS" as any)
              : t("inAppBrowser.stepsAndroid" as any)}
          </span>
        </div>
      </div>
    </div>
  );
}
