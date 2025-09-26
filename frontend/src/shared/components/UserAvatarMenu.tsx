"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";
import ChangePasswordModal from "@/features/auth/components/ChangePasswordModal";
import ChangeEmailModal from "@/features/auth/components/ChangeEmailModal";
import { API_URL } from "@/shared/config";

export default function UserAvatarMenu({
  userId,
  email,
  uid,
}: { userId: number | null; email: string | null; uid: string | null }) {
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = useMemo(() => {
    const n = (email || "").split("@")[0];
    return (n[0] || "?").toUpperCase();
  }, [email]);

  async function onLogout() {
    await supabase.auth.signOut();
    window.location.href = "/"; // alebo router.refresh()
  }

  async function onRequestDelete() {
    if (!userId || !uid) return;
    if (!confirm("Naozaj chceš zrušiť účet? Účet bude pozastavený a po 30 dňoch bez prihlásenia trvalo odstránený.")) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API_URL}/account/request-delete`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ user_id: userId, user_uid: uid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) throw new Error(j?.detail || "Request failed");
      alert("✅ Účet je označený na zmazanie. Prihlásenie do 30 dní požiadavku zruší.");
    } catch (e: any) {
      alert("❌ " + (e?.message ?? "Request failed"));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="w-9 h-9 rounded-full bg-blue-600 text-white font-semibold" title={email || undefined}>
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 bg-gray-800 border border-gray-700 rounded shadow p-2 w-52 z-30">
          <div className="px-2 py-1 text-xs opacity-70 truncate">{email || "—"}</div>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded" onClick={() => { setOpen(false); setPwdOpen(true); }}>
            Zmeniť heslo
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded" onClick={() => { setOpen(false); setEmailOpen(true); }}>
            Zmeniť e-mail
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded" onClick={onLogout}>
            Odhlásiť
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button className="w-full text-left px-2 py-1 hover:bg-red-900/40 rounded text-red-300" onClick={onRequestDelete}>
            Zrušiť účet (hold 30d)
          </button>
        </div>
      )}

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <ChangeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  );
}