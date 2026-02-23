// src/app/features/auth/components/UserMenu.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "@/app/shared/utils/signOut";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser"; 
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetAppSubscriptionStatus } from "@/app/features/billing/api/billing";

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

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
  setSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";
import { useT } from "@/app/shared/i18n/useT";

type LocalUser = {
  email: string | null;
  name: string | null;
  displayName: string | null;
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
  const t = useT();

  // Získame ID používateľa pre API dotazy
  const { userId } = useUserId();

  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // Klientske načítanie základného profilu (meno, email) z JWT
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (!alive || !user) return;
        
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;

        setMe({
          email: user.email ?? null,
          name: fullName,
          displayName: fullName,
        });

      } catch (e) {
        console.warn("[UserMenu] Failed to load user profile:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ Klientske načítanie aktívneho predplatného z nášho Python API
  useEffect(() => {
    let alive = true;
    if (!userId || userId === 0) return;

    (async () => {
      try {
        const status = await apiGetAppSubscriptionStatus(userId);
        if (!alive) return;
        
        const activeTier = status?.tier_code || "free";
        setSubscriptionTier(activeTier); // Uloží to do globálneho store
      } catch (e) {
        console.warn("[UserMenu] Nepodarilo sa načítať status predplatného", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]); // Zbehne iba ak máme platné userId

  useEffect(() => {
    const unsubscribe = subscribeSubscriptionTier((next) =>
      setTierCode(next || "free"),
    );
    return unsubscribe;
  }, []);

  const displayLabel = useMemo(() => {
    const dn = (me?.displayName ?? "").trim();
    if (dn) return dn;
    const nm = (me?.name ?? "").trim();
    if (nm) return nm;
    const em = (me?.email ?? "").trim();
    if (!em) return "";
    const local = em.split("@")[0] ?? "";
    return local || em;
  }, [me?.displayName, me?.name, me?.email]);

  const initials = useMemo(() => {
    const dn = (me?.displayName ?? "").trim();
    if (dn) return "";
    const raw = ((me?.name ?? "") || (me?.email ?? "")).trim();
    if (!raw) return "";
    const base = raw.includes("@") ? (raw.split("@")[0] ?? raw) : raw;
    const parts = base.split(/\s+/).filter(Boolean);

    if (!parts.length) return "";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [me?.displayName, me?.name, me?.email]);

  const getTierBorderStyle = () => {
    switch (tierCode) {
      case "family": return `1px solid ${appColors.brandFamily}`;
      case "pro": return `1px solid ${appColors.brandPro}`;
      case "classic": return `1px solid ${appColors.brandClassic}`;
      case "free":
      default: return `1px solid ${appColors.brandFree}`;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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

  useEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(r.width, 260);
      const margin = 10;
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

  const Panel =
    !open || !pos ? null : createPortal(
          <div
            ref={panelRef}
            className={DROPDOWN_PANEL}
            role="menu"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: pos.width,
              zIndex: 1000000,
              background: appColors.panelBg,
              border: `1px solid ${appColors.panelBorder}`,
              boxShadow: appColors.shadowCard,
            }}
          >
            <div className={USER_MENU_PANEL_HEAD} style={{ borderBottom: `1px solid ${appColors.divider}` }}>
              <div className={USER_MENU_HEAD_ROW}>
                <div className={USER_MENU_HEAD_LEFT}>
                  <div className={USER_MENU_HEAD_NAME} style={{ color: appColors.textPrimary }}>
                    {me?.displayName || me?.name || "User"}
                  </div>
                  <div className={USER_MENU_HEAD_EMAIL} style={{ color: appColors.textMuted }}>
                    {me?.email || ""}
                  </div>
                </div>
              </div>
            </div>

            <nav className={USER_MENU_NAV}>
              <Link className={DROPDOWN_ITEM} href="/account" onClick={() => setOpen(false)}>{t("userMenu.account")}</Link>
              <Link className={DROPDOWN_ITEM} href="/subscription" onClick={() => setOpen(false)}>{t("userMenu.subscription")}</Link>
              <Link className={DROPDOWN_ITEM} href="/connectedApps" onClick={() => setOpen(false)}>{t("userMenu.connectedApps")}</Link>
              <Link className={DROPDOWN_ITEM} href="/onboarding" onClick={() => setOpen(false)}>{t("userMenu.showTutorial")}</Link>
              <div className={DROPDOWN_DIVIDER} />
              <button
                className={[DROPDOWN_ITEM_DANGER, USER_MENU_SIGNOUT_DISABLED].join(" ")}
                onClick={handleSignOut}
                disabled={busy === "signout"}
                type="button"
              >
                {busy === "signout" ? t("userMenu.logginOff") : t("userMenu.logoff")}
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
          background: open ? appColors.surfaceCardHover : appColors.buttonGhostBg,
          border: getTierBorderStyle(),
          color: appColors.textPrimary,
          transition: "border-color 0.2s ease, background-color 0.2s ease",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={USER_MENU_LABEL_ROW}>
          <span className={USER_MENU_LABEL}>{displayLabel || initials || "User"}</span>
        </div>
      </button>
      {Panel}
    </div>
  );
}