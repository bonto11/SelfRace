// src/features/auth/components/ChangePasswordModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/shared/hooks/supabaseClient";

type Props = { open: boolean; onClose: () => void };

function validatePassword(p: string) {
  if (p.length < 8) return "Min. 8 znakov.";
  if (!/[0-9]/.test(p)) return "Aspoň 1 číslica.";
  if (!/[!@#$%^&*()_\-+=\[{\]}|\\:;\"'<>,.?/]/.test(p))
    return "Aspoň 1 špeciálny znak.";
  return null;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  // zisti, či je auth session (inak vypíš hlášku)
  useEffect(() => {
    if (!open) return;
    let unsub = () => {};
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);

      const sub = supabase.auth.onAuthStateChange((_e, session) => {
        setHasSession(!!session);
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub();
  }, [open]);

  // zavri ESC a klik mimo
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const v = validatePassword(pwd);
    if (v) return setErr(v);
    if (pwd !== pwd2) return setErr("Heslá sa nezhodujú.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;

      // odhlás serverovo (cookies) aby middleware okamžite uvidel logout
      await fetch("/api/auth/signout", { method: "POST" });

      onClose();
      router.replace("/signin");
    } catch (e: any) {
      setErr(e?.message ?? "Zmena hesla zlyhala.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div ref={ref} className="w-full max-w-md bg-gray-800 rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Zmeniť heslo</h3>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="password"
            placeholder="Nové heslo"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />
          <input
            type="password"
            placeholder="Zopakuj nové heslo"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />

          {!hasSession && (
            <div className="text-sm text-amber-400">
              Auth session missing!
            </div>
          )}

          {err && <div className="text-sm text-red-400">✖ {err}</div>}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              Zavrieť
            </button>
            <button
              type="submit"
              disabled={busy || !hasSession}
              className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? "Ukladám…" : "Uložiť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}