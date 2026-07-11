// src/app/shared/ui/components/InAppBrowserBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser, tryAndroidIntentRedirect } from "@/app/shared/utils/inAppBrowser";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

const STORAGE_KEY = "sr_inapp_banner_dismissed_at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 6; // 6 hodín — nezobrazuj znova hneď

// ---------------------------------------------------------------------------
// LADENIE POZÍCIE ŠÍPKY — uprav tieto čísla podľa toho, čo uvidíš na telefóne.
// TOP_ARROW  = Instagram / Facebook / väčšina in-app browserov (⋮ vpravo hore)
// BOTTOM_ARROW = Messenger (menu v spodnom paneli)
// ---------------------------------------------------------------------------
const TOP_ARROW = {
  top: 18,   // px od safe-area-inset-top (predtým 58 — teraz nižšie/vyššie podľa potreby)
  right: 50, // px od pravého okraja (predtým 26 — vyššie číslo = viac doľava)
};

const BOTTOM_ARROW = {
  bottom: 16, // px od safe-area-inset-bottom (predtým 58 — teraz bližšie k spodku)
  right: 26,  // px od pravého okraja
};

// Zapni na true, kým ladíte presné hodnoty — vykreslí pravítko s ryskami po 10px
// od pravého a horného/spodného okraja, nech vieš presne odčítať čísla.
const DEBUG_RULER = true;

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
// appName z detekcie nie je vždy spoľahlivý (rôzne casing / názvy), preto
// kontrolujeme aj priamo user-agent ako fallback.
function menuIsAtBottom(appName: string | null): boolean {
  if (appName && appName.toLowerCase().includes("messenger")) return true;

  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/FBAN|FB_IAB|MESSENGER|Messenger/i.test(ua)) return true;
  }

  return false;
}

const ArrowUpRight = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={style}>
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
  <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={style}>
    <path
      d="M8 8L32 32M32 32H14M32 32V14"
      stroke={appColors.brandPrimary}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Jednoduché debug pravítko — vertikálne ryska po 10px od pravého okraja,
// s číslami každých 50px. Slúži LEN na ladenie, potom DEBUG_RULER = false.
const DebugRuler = ({ fromTop }: { fromTop: boolean }) => {
  const marks = Array.from({ length: 12 }, (_, i) => i * 10); // 0..110px
  return (
    <div
      style={{
        position: "fixed",
        [fromTop ? "top" : "bottom"]: 0,
        right: 0,
        width: 120,
        height: 130,
        zIndex: 999998,
        pointerEvents: "none",
      }}
    >
      {marks.map((px) => (
        <div
          key={px}
          style={{
            position: "absolute",
            [fromTop ? "top" : "bottom"]: px,
            right: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 9, color: "rgba(255,80,80,0.9)", marginRight: 4 }}>
            {px}
          </span>
          <div
            style={{
              width: px % 50 === 0 ? 16 : 8,
              height: 1,
              background: "rgba(255,80,80,0.9)",
            }}
          />
        </div>
      ))}
    </div>
  );
};

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
      {DEBUG_RULER && <DebugRuler fromTop={!arrowAtBottom} />}

      {/* Šípka smerujúca presne k trom bodkám menu — hore vpravo (Instagram/väčšina)
          alebo dole vpravo (Messenger). */}
      <div
        style={{
          position: "fixed",
          top: arrowAtBottom ? "auto" : `calc(env(safe-area-inset-top) + ${TOP_ARROW.top}px)`,
          bottom: arrowAtBottom ? `calc(env(safe-area-inset-bottom) + ${BOTTOM_ARROW.bottom}px)` : "auto",
          right: arrowAtBottom ? BOTTOM_ARROW.right : TOP_ARROW.right,
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
          50% { transform: translate(3px, ${arrowAtBottom ? "3px" : "-3px"}); opacity: 1; }
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
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(2px)",
        }}
        onClick={dismiss}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            background: appColors.backgroundAlt,
            border: `1px solid ${appColors.panelBorder}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
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
    </>
  );
}
