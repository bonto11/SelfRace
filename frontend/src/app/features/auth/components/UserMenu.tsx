// src/features/auth/components/UserMenu.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { signOut } from "@/app/shared/utils/signOut";
import {
  AVATAR_BUTTON,
  DROPDOWN_PANEL,
  DROPDOWN_DIVIDER,
  DROPDOWN_ITEM,
  DROPDOWN_ITEM_DANGER,
} from "@/app/shared/ui/classes";

type LocalUser = { email: string; name: string; avatarUrl: string | null };

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reset" | "signout" | null>(null);
  const [me, setMe] = useState<LocalUser | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // načítanie aktuálneho usera
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await fetch("/api/auth/whoami", {
          credentials: "include",
          cache: "no-store",
        });

        if (!r.ok) {
          console.error("[UserMenu] /api/auth/whoami HTTP", r.status);
          return;
        }

        const j = await r.json();
        if (!alive) return;

        // route môže vrátiť { ok, user: {...} } alebo priamo user objekt
        const rawUser = j?.user ?? j;
        if (!rawUser) return;

        const email = String(rawUser.email ?? "").trim();
        const name =
          (rawUser.name as string | undefined) ??
          (rawUser.display_name as string | undefined) ??
          email ??
          "User";

        const avatarUrl =
          (rawUser.avatarUrl as string | null | undefined) ??
          (rawUser.avatar_url as string | null | undefined) ??
          null;

        setMe({
          email,
          name,
          avatarUrl,
        });
      } catch (e) {
        console.error("[UserMenu] whoami fetch error", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const initials = useMemo(() => {
    const n = (me?.name || me?.email || "").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [me?.name, me?.email]);

  // close on outside/Esc
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
      await signOut("/signin");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {me?.avatarUrl ? (
          <Image
            src={me.avatarUrl}
            alt="avatar"
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className={AVATAR_BUTTON}>{initials}</div>
        )}
        <span className="text-sm hidden sm:block">{me?.email ?? ""}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 z-50">
          <div className="rounded-xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
            {/* header sekcia */}
            <div className="px-3 py-2 text-sm border-b border-white/10">
              <div className="font-medium">{me?.name || "User"}</div>
              <div className="opacity-70 truncate">{me?.email}</div>
            </div>

            {/* položky menu */}
            <nav className="py-1 flex flex-col gap-1">
              <a
                className="block w-full px-3 py-2 text-sm hover:bg.white/10"
                href="/forgot-password"
              >
                Zmeniť heslo (e-mailom)
              </a>
              <a
                className="block w-full px-3 py-2 text-sm hover:bg-white/10"
                href="/profile"
              >
                Change email
              </a>
              <button
                className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                onClick={handleSignOut}
                disabled={busy === "signout"}
              >
                {busy === "signout" ? "Signing out…" : "Sign out"}
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}