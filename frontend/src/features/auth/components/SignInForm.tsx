// src/features/auth/components/SignInForm.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function SignInForm() {
  const router = useRouter();

  // lokálny stateless client – žiadny storage (cookie-mode)
  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

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
    setErr(null);
    setLoading(true);

    console.log("[SignIn] create local supabase client (stateless)");
    console.log("[SignIn] trying signInWithPassword", { email });

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pwd,
    });

    console.log("[SignIn] signIn result", {
      ok: !error,
      hasSession: !!data?.session,
      accesstoken: data?.session?.access_token?.slice(0, 8),
      refreshtoken: data?.session?.refresh_token?.slice(0, 8),
      error: error?.message,
    });

    setLoading(false);

    if (error) {
      setErr(error.message || "Prihlásenie zlyhalo.");
      return;
    }

    // nastav serverové cookies
    if (data?.session) {
      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
      });
      console.log("[SignIn] set-session response", res.status);
    }

    router.replace("/dashboard");
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>

      {info && <div className="mb-3 rounded border px-3 py-2 text-sm opacity-90">{info}</div>}

      <form onSubmit={submit} className="space-y-3">
        <input className="w-full rounded border px-3 py-2 bg-background"
               type="email" placeholder="you@email.com"
               value={email} onChange={(e) => setEmail(e.target.value)}
               required autoComplete="email" />
        <input className="w-full rounded border px-3 py-2 bg-background"
               type="password" placeholder="Password"
               value={pwd} onChange={(e) => setPwd(e.target.value)}
               required autoComplete="current-password" />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button type="submit" disabled={loading}
                className="w-full rounded bg-white/10 hover:bg-white/20 px-3 py-2">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-3 text-sm">
        <p><a className="underline opacity-80 hover:opacity-100" href="/forgot-password">Zabudnuté heslo?</a></p>
      </div>
    </div>
  );
}
