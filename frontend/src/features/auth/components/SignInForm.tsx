// src/features/auth/components/SignInForm.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import { toast } from "@/shared/components/ui/Toast";
import { CARD, SURFACE_INSET } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";

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

    const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Prihlásenie zlyhalo.");
      return;
    }

    if (data?.session) {
      try {
        await fetch("/features/auth/api/set-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
        });
      } catch {/* ignore */}
    }

    router.replace("/activities");
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <form onSubmit={submit} className={`${CARD} p-4`}>
        <h1 className="text-base md:text-lg font-semibold mb-3">Sign in</h1>

        {info && (
          <div className={`${SURFACE_INSET} px-3 py-2 text-sm mb-3`}>
            {info}
          </div>
        )}

        <div className="space-y-3">
          <TextField
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoComplete="email"
          />
          <TextField
            type="password"
            placeholder="Password"
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />

          {err && <div className="text-sm text-red-400">{err}</div>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <div className="text-xs text-center">
            <a href="/forgot-password" className="underline" style={{ color: THEME.chart.linePrimary }}>
              Zabudnuté heslo?
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}