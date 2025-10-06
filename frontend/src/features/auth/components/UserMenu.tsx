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
  const [busy, setBusy] = useState<"reset" | "signout" | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // INIT + auth listener
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
    const n = (u?.name || u?.email || "").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [u?.name, u?.email]);

  async function signOut() {
    setBusy("signout");
    try {
      await sb.auth.signOut();
      setOpen(false);
      router.replace("/signin");
    } finally {
      setBusy(null);
    }
  }

  // === RESET PASSWORD via EMAIL ===
async function handlePasswordReset() {
    try {
      const { data, error: meErr } = await sb.auth.getUser();
      if (meErr || !data?.user?.email) throw new Error("not_signed_in");

      await sb.auth.resetPasswordForEmail(data.user.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      await sb.auth.signOut();
      setOpen(false);
      router.replace("/signin?checkEmail=1");
    } catch (e: any) {
      alert(e?.message ?? "Nepodarilo sa odoslať reset e-mail.");
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
      >
        {u?.avatarUrl ? (
          <Image src={u.avatarUrl} alt="avatar" width={28} height={28} className="rounded-full" />
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
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handlePasswordReset}>
              Zmeniť heslo (e-mailom)
            </button>

            <a
              className="block px-3 py-2 text-sm hover:bg-white/10"
              href="/profile"
              onClick={() => setOpen(false)}
            >
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
