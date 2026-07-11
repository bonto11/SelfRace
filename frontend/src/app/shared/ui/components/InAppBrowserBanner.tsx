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

// Messenger má svoje menu (⟳ / zdieľať / ⋯) v spodnom paneli, ostatné in-app
// browsery (Instagram, Facebook, ...) majú tri bodky vpravo hore.
function menuIsAtBottom(appName: string | null): boolean {
  return appName === "Messenger";
}

const ArrowUpRight = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={style}>
    <path
      d="M8 32L32 8M32 8H14M32 8V26"
      stroke={appColors.brandPrimary}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowDownRight = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={style}>
    <path
      d="M8 8L32 32M32 32H14M32 32V14"
      stroke={appColors.brandPrimary}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

  const arrowAtBottom = menuIsAtBottom(info.appName);

  return (
    <>
      {/* Šípka smerujúca k menu — hore vpravo (Instagram/väčšina) alebo dole vpravo (Messenger) */}
      <div
        style={{
          position: "fixed",
          top: arrowAtBottom ? "auto" : "calc(env(safe-area-inset-top) + 6px)",
          bottom: arrowAtBottom ? "calc(env(safe-area-inset-bottom) + 6px)" : "auto",
          right: 8,
          zIndex: 1000000,
          pointerEvents: "none",
          animation: "srArrowBounce 1.4s ease-in-out infinite",
        }}
      >
        {arrowAtBottom ? <ArrowDownRight /> : <ArrowUpRight />}
      </div>

      <style>{`
        @keyframes srArrowBounce {
          0%, 100% { transform: translate(0, 0); opacity: 0.85; }
          50% { transform: translate(4px, ${arrowAtBottom ? "4px" : "-4px"}); opacity: 1; }
        }
      `}</style>

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
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
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

          <div style={{ fontSize: 16, fontWeight: 700, color: appColors.textPrimary, marginBottom: 10 }}>
            {t("inAppBrowser.title" as any)}
          </div>

          <p style={{ fontSize: 13, color: appColors.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
            {t("inAppBrowser.desc" as any).replace("{{app}}", info.appName || "")}
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${appColors.panelBorder}`,
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>
              {info.isIOS ? "︙" : "⋮"}
            </span>
            <span style={{ fontSize: 13, color: appColors.textPrimary, lineHeight: 1.4, textAlign: "center" }}>
              {info.isIOS
                ? t("inAppBrowser.stepsIOS" as any)
                : t("inAppBrowser.stepsAndroid" as any)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
