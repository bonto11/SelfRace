// src/features/auth/components/UserMenu.tsx
// Avatar v topbare + menu. Sign out volá FE signOut aj serverové /api/auth/signout a presmeruje na /signin.

"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";
import ChangePasswordModal from "@/features/auth/components/ChangePasswordModal";
import ChangeEmailModal from "@/features/auth/components/ChangeEmailModal";
import DeleteAccountModal from "@/features/auth/components/DeleteAccountModal";
import { useRouter} from "next/navigation"

function initialsFrom(email?: string | null) {
  if (!email) return "?";
  return email.trim().charAt(0).toUpperCase();
}

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  async function handleLogout() {
    // 1) klientsky logout (hneď skryje usera v UI)
    await supabase.auth.signOut().catch(() => {});
    // 2) server logout – zmaže SSR cookies (s path "/")
    await fetch("/api/auth/signout", { method: "POST", cache: "no-store" }).catch(() => {});
    // 3) presmerovanie (a poistný hard reload)
    router.replace("/signin");
    setTimeout(() => { window.location.href = "/signin"; }, 20);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(t) &&
        menuRef.current &&
        !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative ml-auto">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-blue-600 text-white font-semibold grid place-items-center select-none"
        title={email ?? "Account"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initialsFrom(email)}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-56 rounded border border-gray-700 bg-gray-900 text-sm shadow-xl z-50"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-gray-700 opacity-80 truncate">
            {email ?? "—"}
          </div>

          <button
            className="block w-full text-left px-3 py-2 hover:bg-gray-800"
            onClick={() => { setOpen(false); setPwdOpen(true); }}
          >
            Change password
          </button>

          <button
            className="block w-full text-left px-3 py-2 hover:bg-gray-800"
            onClick={() => { setOpen(false); setEmailOpen(true); }}
          >
            Change email
          </button>

          <button className="block w-full text-left px-3 py-2 hover:bg-gray-800" onClick={handleLogout}>
            Sign out
          </button>

          <div className="border-t border-gray-700" />

          <button
            className="block w-full text-left px-3 py-2 hover:bg-gray-800 text-red-400"
            onClick={() => { setOpen(false); setShowDelete(true); }}
          >
            Delete account…
          </button>
        </div>
      )}

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <ChangeEmailModal    open={emailOpen} onClose={() => setEmailOpen(false)} />
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}