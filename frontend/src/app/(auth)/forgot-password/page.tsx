// src/app/(auth)/forgot-password/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { CARD, SURFACE_INSET, MUTED_TEXT } from "@/app/shared/theme/uiTokens";
import { appColors } from "@/app/shared/theme/app_colors";

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

      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setMsg("Ak účet existuje, poslali sme ti e-mail s odkazom na zmenu hesla.");
    } catch (e: any) {
      setErr(e?.message || "Nepodarilo sa odoslať e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className={`${CARD} p-5 space-y-4`}>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Zabudnuté heslo</h1>
            <p className={MUTED_TEXT}>
              Zadaj e-mail, na ktorý ti pošleme odkaz na nastavenie nového hesla.
            </p>
          </header>

          <div className="space-y-2">
            <label className="text-xs font-medium tracking-wide opacity-80 select-none">
              E-mail
            </label>
            <TextField
              type="email"
              placeholder="tvoj@email.sk"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
              required
            />
          </div>

          {msg && (
            <div
              className={`${SURFACE_INSET} px-3 py-2 text-xs`}
              style={{ color: appColors.statusSuccess }}
            >
              {msg}
            </div>
          )}

          {err && (
            <div
              className={`${SURFACE_INSET} px-3 py-2 text-xs`}
              style={{ color: appColors.statusError }}
            >
              {err}
            </div>
          )}

          <Button type="submit" variant="primary" block disabled={sending}>
            {sending ? "Posielam…" : "Poslať reset e-mail"}
          </Button>
        </form>
      </div>
    </main>
  );
}