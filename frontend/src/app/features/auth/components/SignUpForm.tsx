// src/app/features/auth/components/SignUpForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { toast } from "@/app/shared/components/ui/Toast";
import { CARD, MUTED_TEXT, SURFACE_INSET } from "@/app/shared/theme/uiTokens";
import { appColors } from "@/app/shared/theme/app_colors";

export default function SignUpForm() {
  const sb = getSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const { error } = await sb.auth.signUp({
      email,
      password: pwd,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/coach`,
      },
    });

    setBusy(false);

    if (error) {
      const m = error.message || "Registrácia zlyhala.";
      toast.error(m);
      setMsg(m);
      return;
    }

    const okMsg = "Skontroluj e-mail a potvrď registráciu.";
    setMsg(okMsg);
    toast.success(okMsg);
  }

  const msgColor =
    msg?.toLowerCase().includes("skontroluj") ? appColors.statusSuccess : appColors.statusError;

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <form onSubmit={submit} className={`${CARD} p-5 space-y-4`}>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Vytvoriť účet</h1>
            <p className={MUTED_TEXT}>
              Sleduj tréningy, analyzuj dáta a nechaj AI pripraviť plán na mieru.
            </p>
          </header>

          <div className="space-y-3">
            <TextField
              placeholder="Meno (voliteľné)"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextField
              type="email"
              placeholder="tvoje@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
            />
            <TextField
              type="password"
              placeholder="Heslo (min. 6 znakov)"
              required
              value={pwd}
              onChange={(e) => setPwd(e.currentTarget.value)}
              autoComplete="new-password"
            />

            {msg && (
              <div className={`${SURFACE_INSET} px-3 py-2 text-xs leading-snug`} style={{ color: msgColor }}>
                {msg}
              </div>
            )}

            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? "Vytváram…" : "Registrovať"}
            </Button>

            <div className="text-xs text-center" style={{ color: appColors.textMuted }}>
              Už máš účet?{" "}
              <Link className="underline underline-offset-2" href="/signin" style={{ color: appColors.textPrimary }}>
                Prihlás sa
              </Link>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: appColors.textMuted }}>
            <span>SelfRace • AI tréning pre atlétov</span>

            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] uppercase tracking-wide text-[10px] backdrop-blur"
              style={{
                background: appColors.pillBg,
                border: `1px solid ${appColors.pillBorder}`,
                color: appColors.textSecondary,
              }}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: appColors.statusWarning,
                  boxShadow: `0 0 0 3px ${appColors.pillActiveBg}`,
                }}
              />
              Powered by Strava
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}