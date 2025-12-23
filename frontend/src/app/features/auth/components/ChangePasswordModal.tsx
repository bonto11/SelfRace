// src/features/auth/components/ChangePasswordModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/shared/hooks/supabaseClient";

// UI systém
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { SURFACE_SUBCARD } from "@/app/shared/ui/classes";

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

  // zisti session
  useEffect(() => {
    if (!open) return;
    let unsub = () => {};
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      const sub = supabase.auth.onAuthStateChange((_e, session) =>
        setHasSession(!!session)
      );
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub();
  }, [open]);

  // ESC + klik mimo
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
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4">
      <div ref={ref} className={`${SURFACE_SUBCARD} w-full max-w-md p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base md:text-lg font-semibold">Zmeniť heslo</h3>
          <button
            onClick={onClose}
            className="text-sm opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <TextField
            type="password"
            placeholder="Nové heslo"
            value={pwd}
            onChange={(e) => setPwd((e.target as HTMLInputElement).value)}
          />
          <TextField
            type="password"
            placeholder="Zopakuj nové heslo"
            value={pwd2}
            onChange={(e) => setPwd2((e.target as HTMLInputElement).value)}
          />

          {!hasSession && (
            <div className="text-xs text-amber-400">Auth session missing!</div>
          )}
          {err && <div className="text-sm text-rose-400">✖ {err}</div>}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Zavrieť
            </Button>
            <Button
              type="submit"
              variant="success"
              size="sm"
              disabled={busy || !hasSession}
            >
              {busy ? "Ukladám…" : "Uložiť"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
