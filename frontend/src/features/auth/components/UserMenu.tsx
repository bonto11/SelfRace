// src/features/auth/components/UserMenu.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type LocalUser = { email: string; name: string; avatarUrl: string | null };

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reset" | "signout" | null>(null);
  const [me, setMe] = useState<LocalUser | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // načítaj profil zo servera (z Supabase cookies)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) setMe(j.user as LocalUser);
      } catch {
        /* ignore */
      }
    })();
    return () => { alive = false; };
  }, []);

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

  const initials = useMemo(() => {
    const n = (me?.name || me?.email || "").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [me?.name, me?.email]);

  async function signOut() {
    setBusy("signout");
    try {
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "SIGNED_OUT" }),
      });
      setOpen(false);
      router.replace("/signin");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
              onClick={() => setOpen(v => !v)}>
        {me?.avatarUrl ? (
          <Image src={me.avatarUrl} alt="avatar" width={28} height={28} className="rounded-full" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
        <span className="text-sm hidden sm:block">{me?.email ?? ""}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-background shadow-lg z-50">
          <div className="px-3 py-2 text-sm border-b">
            <div className="font-medium">{me?.name || "User"}</div>
            <div className="opacity-70 truncate">{me?.email}</div>
          </div>
          <nav className="py-1">
            <a className="block px-3 py-2 text-sm hover:bg-white/10" href="/forgot-password">
              Zmeniť heslo (e-mailom)
            </a>
            <a className="block px-3 py-2 text-sm hover:bg-white/10" href="/profile">
              Change email
            </a>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              onClick={signOut}
              disabled={busy === "signout"}
            >
              {busy === "signout" ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}