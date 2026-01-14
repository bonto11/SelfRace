// src/app/features/auth/components/SignUpForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { toast } from "@/app/shared/components/ui/Toast";
import { CARD } from "@/app/shared/ui/classes";

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

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <form onSubmit={submit} className={`${CARD} p-5 space-y-4`}>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Vytvoriť účet</h1>
            <p className="text-sm text-white/70">
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
              <div className="text-xs text-white/80 leading-snug">{msg}</div>
            )}

            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? "Vytváram…" : "Registrovať"}
            </Button>

            <div className="text-xs text-center text-white/60">
              Už máš účet?{" "}
              <Link className="underline" href="/signin">
                Prihlás sa
              </Link>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-white/50">
            <span>SelfRace • AI tréning pre atlétov</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-[2px] uppercase tracking-wide text-[10px]">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              Powered by Strava
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}