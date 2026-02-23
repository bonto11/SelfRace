"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "@/app/shared/utils/signOut";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetAppSubscriptionStatus } from "@/app/features/billing/api/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  setSubscriptionTier,
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";
import { useT } from "@/app/shared/i18n/useT";
import {
  DROPDOWN_DIVIDER,
  DROPDOWN_PANEL,
  DROPDOWN_ITEM,
  DROPDOWN_ITEM_DANGER,
} from "@/app/shared/ui/tokens";
import {
  USER_MENU_WRAP,
  USER_MENU_TRIGGER,
  USER_MENU_LABEL_ROW,
  USER_MENU_LABEL,
  USER_MENU_PANEL_HEAD,
  USER_MENU_HEAD_ROW,
  USER_MENU_HEAD_LEFT,
  USER_MENU_HEAD_NAME,
  USER_MENU_HEAD_EMAIL,
  USER_MENU_NAV,
  USER_MENU_SIGNOUT_DISABLED,
} from "@/app/shared/ui/tokens/userMenu";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{
    email: string | null;
    name: string | null;
  } | null>(null);
  const [tier, setTier] = useState(() => getSubscriptionTier() || "free");
  const { userId } = useUserId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const t = useT();

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = getSupabaseBrowser();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!alive || !session?.user) return;
      setMe({
        email: session.user.email ?? null,
        name: session.user.user_metadata?.full_name ?? null,
      });

      if (userId) {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (alive && st?.tier_code) setSubscriptionTier(st.tier_code);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(
    () => subscribeSubscriptionTier((next) => setTier(next || "free")),
    [],
  );

  const getBorder = () => {
    const colors: Record<string, string> = {
      family: appColors.brandFamily,
      pro: appColors.brandPro,
      classic: appColors.brandClassic,
    };
    return `1px solid ${colors[tier] || appColors.brandFree}`;
  };

  if (!me) return null;

  return (
    <div className={USER_MENU_WRAP}>
      <button
        ref={btnRef}
        className={USER_MENU_TRIGGER}
        style={{
          border: getBorder(),
          background: open
            ? appColors.surfaceCardHover
            : appColors.buttonGhostBg,
        }}
        onClick={() => setOpen(!open)}
      >
        <span className={USER_MENU_LABEL}>
          {me.name || me.email?.split("@")[0] || "User"}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            className={DROPDOWN_PANEL}
            style={{
              position: "fixed",
              right: 20,
              top: 60,
              width: 260,
              zIndex: 9999,
              background: appColors.panelBg,
              border: `1px solid ${appColors.panelBorder}`,
            }}
          >
            <div className={USER_MENU_PANEL_HEAD}>
              <div className={USER_MENU_HEAD_NAME}>{me.name}</div>
              <div className={USER_MENU_HEAD_EMAIL}>{me.email}</div>
            </div>
            <nav className={USER_MENU_NAV}>
              <Link
                className={DROPDOWN_ITEM}
                href="/account"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.account")}
              </Link>
              <Link
                className={DROPDOWN_ITEM}
                href="/connectedApps"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.connectedApps")}
              </Link>
              <div className={DROPDOWN_DIVIDER} />
              <button
                className={DROPDOWN_ITEM_DANGER}
                onClick={() => signOut("/")}
              >
                {t("userMenu.logoff")}
              </button>
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
