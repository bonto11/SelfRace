// src/features/auth/components/SignInForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";

export default function SignInForm() {
  const router = useRouter();
  const sb = getSupabaseBrowser();

  const [email, setEmail] = useState<string>("");
  const [pwd, setPwd] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace("/dashboard"); // alebo tvoja landing protected stránka
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2 bg-background"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded border px-3 py-2 bg-background"
          type="password"
          placeholder="Password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-white/10 hover:bg-white/20 px-3 py-2"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-3 text-sm">
        <p className="text-sm">
            <a className="underline opacity-80 hover:opacity-100" href="/forgot-password">
                Zabudnuté heslo?
            </a>
            </p>
      </div>
    </div>
  );
}