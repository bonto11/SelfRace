// src/features/auth/components/UserMenu.tsx
// src/features/auth/components/UserMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

type LocalUser = { email: string; name: string; avatarUrl: string | null };

export default function UserMenu({ user }: { user: LocalUser }) {
  const router = useRouter();
  const sb = getSupabaseBrowser();
  const [open, setOpen] = useState(false);
  const [u, setU] = useState<LocalUser | null>(user ?? null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // 1) init — dotiahni usera ak treba
  useEffect(() => {
    sb.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!data.user) return;
      const meta = (data.user.user_metadata as Record<string, any>) || {};
      setU({
        email: data.user.email ?? "",
        name: meta.full_name ?? meta.name ?? "",
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      });
    });
    // 2) reaguj na zmeny auth stavu
    const sub = sb.auth.onAuthStateChange(
      (_ev: AuthChangeEvent, session: Session | null) => {
        const sUser = session?.user;
        if (!sUser) return;
        const meta = (sUser.user_metadata as Record<string, any>) || {};
        setU({
          email: sUser.email ?? "",
          name: meta.full_name ?? meta.name ?? "",
          avatarUrl: meta.avatar_url ?? meta.picture ?? null,
        });
      }
    );
    return () => sub.data.subscription.unsubscribe();
  }, [sb]);

  // zavri pri kliku mimo / ESC
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
    const n = (u?.name || u?.email || "").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [u?.name, u?.email]);

  async function signOut() {
    await sb.auth.signOut();
    setOpen(false);
    router.replace("/signin");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
      >
        {u?.avatarUrl ? (
          <Image
            src={u.avatarUrl}
            alt="avatar"
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
        <span className="text-sm hidden sm:block">{u?.email}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-background shadow-lg z-50">
          <div className="px-3 py-2 text-sm border-b">
            <div className="font-medium">{u?.name || "User"}</div>
            <div className="opacity-70 truncate">{u?.email}</div>
          </div>
          <nav className="py-1">
            <a
              className="block px-3 py-2 text-sm hover:bg-white/10"
              href="/update-password"
              onClick={() => setOpen(false)}
            >
              Update password
            </a>
            <a
              className="block px-3 py-2 text-sm hover:bg-white/10"
              href="/profile"
              onClick={() => setOpen(false)}
            >
              Change email
            </a>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
              onClick={signOut}
            >
              Sign out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}