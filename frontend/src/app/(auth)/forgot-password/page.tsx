// src/app/(auth)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";

export default function ForgotPasswordPage() {
  const sb = getSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr("Zadaj platný e-mail.");
      return;
    }

    setSending(true);
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = `${origin}/update-password`;

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;

      setMsg(
        "Ak účet existuje, poslali sme ti e-mail s odkazom na zmenu hesla.",
      );
    } catch (e: any) {
      setErr(e?.message || "Nepodarilo sa odoslať e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="mx-auto max-w-md w-full p-6 space-y-4 rounded-xl bg-slate-950/60 border border-white/10">
        <h1 className="text-xl font-semibold">Zabudnuté heslo</h1>
        <p className="text-sm text-white/70">
          Zadaj e-mail, na ktorý ti pošleme odkaz na nastavenie nového hesla.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              type="email"
              className="w-full rounded-md bg-slate-900 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tvoj@email.sk"
              autoComplete="email"
              required
            />
          </div>

          {msg && <div className="text-sm text-emerald-400">{msg}</div>}
          {err && <div className="text-sm text-red-400">{err}</div>}

          <Button type="submit" variant="primary" block disabled={sending}>
            {sending ? "Posielam…" : "Poslať reset e-mail"}
          </Button>
        </form>
      </div>
    </main>
  );
}