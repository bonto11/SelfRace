// src/features/auth/components/UserMenu.tsx
"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type LocalUser = { email: string; name: string; avatarUrl: string | null };
type Props = { user?: LocalUser };

export default function UserMenu({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reset" | "signout" | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

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
    const n = (user?.name || user?.email || "").trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }, [user?.name, user?.email]);

  async function signOut() {
    setBusy("signout");
    try {
      // vymaz cookies cez server
      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "SIGNED_OUT" }),
      });
      console.log("[UserMenu] signout set-session", res.status);
      setOpen(false);
      router.replace("/signin");
    } finally {
      setBusy(null);
    }
  }

  async function handlePasswordReset() {
    // pri cookie-mode odporúčam reset robiť cez samostatnú stránku s formom (email),
    // ale ak chceš „quick“, redirectni usera na /forgot-password:
    router.push("/forgot-password");
  }

  return (
    <div ref={boxRef} className="relative">
      <button className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
              onClick={() => setOpen(v => !v)}>
        {user?.avatarUrl ? (
          <Image src={user.avatarUrl} alt="avatar" width={28} height={28} className="rounded-full" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
        <span className="text-sm hidden sm:block">{user?.email}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-background shadow-lg z-50">
          <div className="px-3 py-2 text-sm border-b">
            <div className="font-medium">{user?.name || "User"}</div>
            <div className="opacity-70 truncate">{user?.email}</div>
          </div>
          <nav className="py-1">
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                    onClick={handlePasswordReset}>
              Zmeniť heslo (e-mailom)
            </button>
            <a className="block px-3 py-2 text-sm hover:bg-white/10"
               href="/profile" onClick={() => setOpen(false)}>
              Change email
            </a>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
                    onClick={signOut} disabled={busy === "signout"}>
              {busy === "signout" ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
