"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { signOut } from "@/app/shared/utils/signOut";
import { AVATAR_BUTTON } from "@/app/shared/theme/uiTokens";
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
    () => getSubscriptionTier() || "free"
  );
  const boxRef = useRef<HTMLDivElement | null>(null);

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
        if (j?.ok && j.user) {
          const user = j.user as LocalUser;
          setMe(user);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSubscriptionTier((next) => {
      setTierCode(next || "free");
    });
    return unsubscribe;
  }, []);

  const label = useMemo(
    () => me?.displayName || me?.name || me?.email || "",
    [me?.displayName, me?.name, me?.email]
  );

  const initials = useMemo(() => {
    const raw = (me?.name || me?.displayName || me?.email || "").trim();
    if (!raw) return "";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [me?.name, me?.displayName, me?.email]);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onEsc = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function handleSignOut() {
    setBusy("signout");
    try {
      await signOut("/");
    } finally {
      setBusy(null);
    }
  }

  const tierClass =
    tierCode === "pro"
      ? "bg-purple-500/90 text-white"
      : tierCode === "classic"
      ? "bg-sky-600/90 text-white"
      : "bg-slate-700 text-slate-100";

  return (
    <div ref={boxRef} className="relative">
      <button
        className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="flex items-center gap-1 max-w-[160px]">
          <span className="text-sm max-w-[120px] truncate text-right">
            {label}
          </span>
          {tierCode && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold ${tierClass}`}
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = "/account";
              }}
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
            className="rounded-full"
          />
        ) : initials ? (
          <div className={AVATAR_BUTTON}>{initials}</div>
        ) : (
          <div className={AVATAR_BUTTON} aria-hidden="true">
            <svg viewBox="0 0 24 24" width={18} height={18}>
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-3.33 0-6 2.02-6 4.5V20h12v-1.5C18 16.02 15.33 14 12 14Z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 z-50">
          <div className="rounded-xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
            <div className="px-3 py-2 text-sm border-b border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {me?.displayName || me?.name || "User"}
                  </div>
                  <div className="opacity-70 truncate">
                    {me?.email || me?.name || ""}
                  </div>
                </div>
                {tierCode && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold ${tierClass}`}
                  >
                    {tierCode.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <nav className="py-1 flex flex-col gap-1">
              <a
                className="block w-full px-3 py-2 text-sm hover:bg-white/10"
                href="/account"
              >
                Account
              </a>

              <a
                className="block w-full px-3 py-2 text-sm hover:bg-white/10"
                href="/connectedApps"
              >
                Connected apps
              </a>

              <button
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                onClick={handleSignOut}
                disabled={busy === "signout"}
              >
                {busy === "signout" ? "Odhlasujem…" : "Odhlásiť sa"}
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
