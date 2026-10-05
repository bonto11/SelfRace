// src/app/features/auth/components/UserMenu.tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Compass,
  CreditCard,
  Link2,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";

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

const MENU_WIDTH = 296;
const MENU_Z = 2147483600; // menu nad modalmi (konvencia)

type Tier = "free" | "classic" | "pro" | "family";

function tierColor(tier: string): string {
  const colors: Record<string, string> = {
    family: appColors.brandFamily,
    pro: appColors.brandPro,
    classic: appColors.brandClassic,
  };
  return colors[tier] || appColors.brandFree;
}

function initialsOf(label: string): string {
  const parts = label.trim().split(/[\s._-]+/).filter(Boolean);
  const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (s || label.slice(0, 2)).toUpperCase();
}

function Avatar({ label, tier, size }: { label: string; tier: string; size: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `linear-gradient(135deg, ${appColors.brandPrimary}, ${appColors.brandDark})`,
        color: appColors.textPrimary,
        // farba rámika = úroveň predplatného
        boxShadow: `0 0 0 2px ${appColors.backgroundMain}, 0 0 0 3.5px ${tierColor(tier)}`,
      }}
    >
      {initialsOf(label)}
    </span>
  );
}

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
};

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<{ email: string | null; name: string | null } | null>(null);
  const [tier, setTier] = useState<string>(() => getSubscriptionTier() || "free");
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 60, right: 10 });
  const { userId } = useUserId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const t = useT();

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = getSupabaseBrowser();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!alive) return;

      if (session?.user) {
        setMe({
          email: session.user.email ?? null,
          name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
        });
      }

      if (userId && userId !== 0) {
        const st = await apiGetAppSubscriptionStatus(userId);
        if (alive && st?.tier_code) setSubscriptionTier(st.tier_code);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => subscribeSubscriptionTier((next) => setTier(next || "free")), []);

  // zmena stránky menu zavrie (aj pri navigácii mimo položiek menu)
  useEffect(() => setOpen(false), [pathname]);

  // pozícia pod tlačidlom – hlavička je fixná, ale na PC má inú šírku
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: Math.round(r.bottom + 8),
      right: Math.max(8, Math.round(window.innerWidth - r.right)),
    });
  }, [open]);

  // klik mimo / Escape zavrie
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = me?.name || me?.email?.split("@")[0] || "User";
  const tierKey = (["free", "classic", "pro", "family"].includes(tier) ? tier : "free") as Tier;

  const items: Item[] = [
    { href: "/bio", label: t("userMenu.bio"), icon: UserRound },
    { href: "/connectedApps", label: t("userMenu.connectedApps"), icon: Link2 },
    { href: "/settings", label: t("userMenu.settings"), icon: Settings },
    { href: "/onboarding", label: t("userMenu.showTutorial"), icon: Compass },
  ];

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-colors cursor-pointer"
        style={{
          background: open ? appColors.surfaceCardHover : appColors.buttonGhostBg,
          border: `1px solid ${appColors.surfaceCardBorder}`,
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar label={label} tier={tierKey} size={28} />
        <span className="text-sm max-w-[120px] truncate" style={{ color: appColors.textPrimary }}>
          {label}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="rounded-2xl overflow-hidden"
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              width: MENU_WIDTH,
              maxWidth: "calc(100vw - 16px)",
              zIndex: MENU_Z,
              // plná farba – sklenený panel bol cez obsah stránky zle čitateľný
              background: appColors.surfaceSolid,
              border: `1px solid ${appColors.panelBorder}`,
              boxShadow: "0 20px 40px -12px rgba(0,0,0,0.65)",
              animation: "sr-menu-in 140ms ease-out",
            }}
          >
            <style>{`@keyframes sr-menu-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}`}</style>

            {/* Profil */}
            <div className="p-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${appColors.panelBorder}` }}>
              <Avatar label={label} tier={tierKey} size={44} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate" style={{ color: appColors.textPrimary }}>
                  {me?.name || label}
                </div>
                <div className="text-xs truncate" style={{ color: appColors.textMuted }}>
                  {me?.email || ""}
                </div>
              </div>
            </div>

            {/* Predplatné */}
            <Link
              href="/subscription"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mx-3 mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:brightness-125"
              style={{
                background: appColors.surfaceCard,
                border: `1px solid ${appColors.surfaceCardBorder}`,
              }}
            >
              <CreditCard size={18} color={tierColor(tierKey)} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
                  {t("userMenu.subscription")}
                </div>
                <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                  {t(`userMenu.tiers.${tierKey}` as any)}
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
              >
                {t("userMenu.manage")}
              </span>
            </Link>

            {/* Navigácia */}
            <nav className="p-2 mt-1">
              {items.map(({ href, label: itemLabel, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                    style={{ background: active ? appColors.surfaceCardHover : "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = appColors.surfaceCardHover)}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = active ? appColors.surfaceCardHover : "transparent")
                    }
                  >
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                      style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
                    >
                      <Icon size={16} color={active ? appColors.brandPrimary : appColors.textSecondary} />
                    </span>
                    <span className="flex-1 text-sm" style={{ color: appColors.textPrimary }}>
                      {itemLabel}
                    </span>
                    <ChevronRight size={16} color={appColors.textMuted} />
                  </Link>
                );
              })}
            </nav>

            <div className="p-2" style={{ borderTop: `1px solid ${appColors.panelBorder}` }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  signOut("/");
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
                style={{ color: appColors.statusError }}
                onMouseEnter={(e) => (e.currentTarget.style.background = appColors.surfaceCardHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0">
                  <LogOut size={16} color={appColors.statusError} />
                </span>
                <span className="text-sm font-medium">{t("userMenu.logoff")}</span>
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
