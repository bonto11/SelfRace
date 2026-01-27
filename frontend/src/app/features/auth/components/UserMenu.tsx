// src/app/features/auth/components/UserMenu.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { signOut } from "@/app/shared/utils/signOut";
import {
  AVATAR_BUTTON,
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
  USER_MENU_TIER_PILL,
  USER_MENU_AVATAR_IMG,
  USER_MENU_PANEL_HEAD,
  USER_MENU_HEAD_ROW,
  USER_MENU_HEAD_LEFT,
  USER_MENU_HEAD_NAME,
  USER_MENU_HEAD_EMAIL,
  USER_MENU_NAV,
  USER_MENU_SIGNOUT_DISABLED,
} from "@/app/shared/ui/tokens/userMenu";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

type LocalUser = {
  id: number | null;
  uuid: string | null;
  email: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"signout" | null>(null);
  const [me, setMe] = useState<LocalUser | null>(null);
  const [tierCode, setTierCode] = useState<string>(
    () => getSubscriptionTier() || "free",
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && j.user) setMe(j.user as LocalUser);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSubscriptionTier((next) =>
      setTierCode(next || "free"),
    );
    return unsubscribe;
  }, []);

  const label = useMemo(
    () => me?.displayName || me?.name || me?.email || "",
    [me?.displayName, me?.name, me?.email],
  );

  const initials = useMemo(() => {
    const raw = (me?.name || me?.displayName || me?.email || "").trim();
    if (!raw) return "";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [me?.name, me?.displayName, me?.email]);

  // close on outside click (portal-safe)
  useEffect(() => {
    if (!open) return;

    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };

    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // compute fixed position (portal)
  useEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();

      // menu width: at least trigger width, but keep nice readable max
      const w = Math.max(r.width, 260);
      const margin = 10;

      // align right edge to trigger right edge
      let left = r.right - w;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

      const top = r.bottom + 10;

      setPos({ left, top, width: w });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  async function handleSignOut() {
    setBusy("signout");
    try {
      await signOut("/");
    } finally {
      setBusy(null);
    }
  }

  const tierStyle =
    tierCode === "pro"
      ? {
          background: "rgba(56,189,248,0.16)",
          border: `1px solid ${appColors.panelBorder}`,
          color: appColors.textPrimary,
        }
      : tierCode === "classic"
        ? {
            background: "rgba(163,230,53,0.14)",
            border: `1px solid ${appColors.pillActiveBorder}`,
            color: appColors.textPrimary,
          }
        : {
            background: appColors.pillBg,
            border: `1px solid ${appColors.pillBorder}`,
            color: appColors.textSecondary,
          };

  const Panel =
    !open || !pos
      ? null
      : createPortal(
          <div
            ref={panelRef}
            className={DROPDOWN_PANEL}
            role="menu"
            aria-label="User menu"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: pos.width,
              // MUST be above sticky header (z-30) + cards/backdrop contexts
              zIndex: 1000000,

              background: appColors.panelBg,
              border: `1px solid ${appColors.panelBorder}`,
              boxShadow: appColors.shadowCard,
            }}
          >
            <div
              className={USER_MENU_PANEL_HEAD}
              style={{ borderBottom: `1px solid ${appColors.divider}` }}
            >
              <div className={USER_MENU_HEAD_ROW}>
                <div className={USER_MENU_HEAD_LEFT}>
                  <div
                    className={USER_MENU_HEAD_NAME}
                    style={{ color: appColors.textPrimary }}
                  >
                    {me?.displayName || me?.name || "User"}
                  </div>
                  <div
                    className={USER_MENU_HEAD_EMAIL}
                    style={{ color: appColors.textMuted }}
                  >
                    {me?.email || me?.name || ""}
                  </div>
                </div>

                {tierCode && (
                  <span className={USER_MENU_TIER_PILL} style={tierStyle}>
                    {tierCode.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <nav className={USER_MENU_NAV}>
              <a className={DROPDOWN_ITEM} href="/account" role="menuitem">
                Account
              </a>

              <a
                className={DROPDOWN_ITEM}
                href="/connectedApps"
                role="menuitem"
              >
                Connected apps
              </a>

              <div className={DROPDOWN_DIVIDER} />

              <button
                className={[
                  DROPDOWN_ITEM_DANGER,
                  USER_MENU_SIGNOUT_DISABLED,
                ].join(" ")}
                onClick={handleSignOut}
                disabled={busy === "signout"}
                role="menuitem"
                type="button"
              >
                {busy === "signout" ? "Odhlasujem…" : "Odhlásiť sa"}
              </button>
            </nav>
          </div>,
          document.body,
        );

  return (
    <div ref={wrapRef} className={USER_MENU_WRAP}>
      <button
        ref={btnRef}
        className={USER_MENU_TRIGGER}
        style={{
          background: open
            ? appColors.surfaceCardHover
            : appColors.buttonGhostBg,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          color: appColors.textPrimary,
        }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
        onMouseDown={(e) => e.preventDefault()} // iOS “sticky focus”
      >
        <div className={USER_MENU_LABEL_ROW}>
          <span className={USER_MENU_LABEL}>{label}</span>

          {tierCode && (
            <span
              className={USER_MENU_TIER_PILL}
              style={tierStyle}
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = "/account";
              }}
              role="button"
              tabIndex={0}
            >
              {tierCode.toUpperCase()}
            </span>
          )}
        </div>

        {me?.avatarUrl ? (
          <Image
            src={me.avatarUrl}
            alt={label || "User avatar"}
            width={28}
            height={28}
            className={USER_MENU_AVATAR_IMG}
          />
        ) : initials ? (
          <div className={AVATAR_BUTTON}>{initials}</div>
        ) : (
          <div className={AVATAR_BUTTON} aria-hidden="true">
            <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-3.33 0-6 2.02-6 4.5V20h12v-1.5C18 16.02 15.33 14 12 14Z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
      </button>

      {Panel}
    </div>
  );
}
