// src/app/(auth)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";

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
      // redirectTo musí byť plná URL
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectTo = `${origin}/update-password`;

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;

      setMsg(
        "Ak účet existuje, poslali sme ti e-mail s odkazom na zmenu hesla."
      );
    } catch (e: any) {
      setErr(e?.message || "Nepodarilo sa odoslať e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-4">Zabudnuté heslo</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input
            type="email"
            className="w-full rounded border bg-background px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tvoj@email.sk"
            autoComplete="email"
            required
          />
        </div>

        {msg && <div className="text-sm text-emerald-500">{msg}</div>}
        {err && <div className="text-sm text-red-500">{err}</div>}

        <button
          type="submit"
          disabled={sending}
          className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
        >
          {sending ? "Posielam…" : "Poslať reset e-mail"}
        </button>
      </form>
    </div>
  );
}