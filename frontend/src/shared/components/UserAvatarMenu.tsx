"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChangePasswordModal from "@/features/auth/components/ChangePasswordModal";
import ChangeEmailModal from "@/features/auth/components/ChangeEmailModal";
import { API_URL } from "@/shared/config";
// voliteľné: len ak potrebuješ token pre /account/request-delete
import { supabase } from "@/shared/hooks/supabaseClient";
import { resetClientCache } from "@/shared/utils/resetClientCache";

import {
  AVATAR_BUTTON,
  DROPDOWN_PANEL,
  DROPDOWN_DIVIDER,
  DROPDOWN_ITEM,
  DROPDOWN_ITEM_DANGER,
  MUTED_TEXT,
} from "@/shared/ui/classes";

export default function UserAvatarMenu({
  userId,
  email,
  uid,
}: { userId: number | null; email: string | null; uid: string | null }) {
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // zatváranie pri kliknutí mimo
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
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
      });
    } catch {
      // no-op
    } finally {
      window.location.href = "/signin";
    }
  }

  async function onRequestDelete() {
    if (!userId || !uid) return;
    if (
      !confirm(
        "Naozaj chceš zrušiť účet? Účet bude pozastavený a po 30 dňoch bez prihlásenia trvalo odstránený."
      )
    ) {
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API_URL}/account/request-delete`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      <button
        onClick={() => setOpen((v) => !v)}
        className={AVATAR_BUTTON}
        title={email || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div role="menu" className={DROPDOWN_PANEL}>
          <div className={`${MUTED_TEXT} px-2 py-1 truncate`}>{email || "—"}</div>

          <button
            className={DROPDOWN_ITEM}
            onClick={() => {
              setOpen(false);
              setPwdOpen(true);
            }}
            role="menuitem"
          >
            Zmeniť heslo
          </button>

          <button
            className={DROPDOWN_ITEM}
            onClick={() => {
              setOpen(false);
              setEmailOpen(true);
            }}
            role="menuitem"
          >
            Zmeniť e-mail
          </button>

          <button className={DROPDOWN_ITEM} onClick={onLogout} role="menuitem">
            Odhlásiť
          </button>

          <div className={DROPDOWN_DIVIDER} />

          <button className={DROPDOWN_ITEM_DANGER} onClick={onRequestDelete} role="menuitem">
            Zrušiť účet (hold 30d)
          </button>



          <button
            type="button"
            onClick={resetClientCache}
            className="text-[11px] px-2 py-1 rounded border border-red-500/60 text-red-300 hover:bg-red-500/10"
          >
            Reset coach cache
          </button>
        </div>
      )}

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <ChangeEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  );
}