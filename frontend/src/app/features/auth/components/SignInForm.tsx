// src/features/auth/components/SignInForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { toast } from "@/app/shared/components/ui/Toast";
import { CARD, SURFACE_INSET } from "@/app/shared/ui/uiTokens";
import { THEME } from "@/app/shared/theme/tokens";

export default function SignInForm() {
  const router = useRouter();
  const sb = getSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sp = useSearchParams();
  const info =
    sp.get("checkEmail") === "1"
      ? "Poslali sme ti e-mail s odkazom na zmenu hesla. Skontroluj inbox/spam."
      : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pwd,
    });
    setLoading(false);

    if (error) {
      const msg = error.message || "Prihlásenie zlyhalo.";
      setErr(msg);
      toast.error(msg);
      return;
    }

    if (data?.session) {
      try {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
        });
      } catch {
        /* ignore */
      }
    }

    router.replace("/activities");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className={`${CARD} p-5 space-y-4`}>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">Prihlásenie</h1>
            <p className="text-sm text-white/70">
              Vráť sa späť k svojim tréningom, plánom a AI trénerovi.
            </p>
          </header>

          {info && (
            <div className={`${SURFACE_INSET} px-3 py-2 text-xs`}>{info}</div>
          )}

          <div className="space-y-3">
            <TextField
              type="email"
              placeholder="tvoje@email.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              autoComplete="email"
            />
            <TextField
              type="password"
              placeholder="Heslo"
              value={pwd}
              onChange={(e) => setPwd(e.currentTarget.value)}
              required
              autoComplete="current-password"
            />

            {err && <div className="text-sm text-red-400">{err}</div>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Prihlasujem…" : "Prihlásiť sa"}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <Link
                href="/forgot-password"
                className="underline"
                style={{ color: THEME.chart.linePrimary }}
              >
                Zabudnuté heslo?
              </Link>
              <span className="text-white/60">
                Nemáš účet?{" "}
                <Link href="/signup" className="underline">
                  Registruj sa
                </Link>
              </span>
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
