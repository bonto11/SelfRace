// src/app/(auth)/signin/Page.tsx
// Sign in stránka. Po úspechu zavolá /api/auth/set-session, aby sa nastavili server cookies, potom redirect.

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/shared/hooks/supabaseClient";

export default function SigninPage() {
  const router = useRouter();
  const qs = useSearchParams();

  const nextParam = qs.get("next");
  const nextPath =
    typeof nextParam === "string" && nextParam.startsWith("/")
      ? decodeURIComponent(nextParam)
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(nextPath);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) {
        setErr(error.message || "Login failed");
        return;
      }
      if (data.session) {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }),
        });
      }
      router.replace(nextPath);
    } catch (e: any) {
      setErr(e?.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded p-6 shadow space-y-4">
        <h1 className="text-xl font-bold">Sign in</h1>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />
          <input
            type="password"
            placeholder="Heslo"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 disabled:opacity-50"
          >
            {loading ? "Prihlasujem…" : "Sign in"}
          </button>

          <div className="flex justify-between text-sm">
            <a className="underline opacity-90 hover:opacity-100" href="/signin#forgot">
              Forgot password?
            </a>
            <a className="underline opacity-90 hover:opacity-100" href="/signup">
              Create account
            </a>
          </div>
        </form>

        {err && <p className="text-red-400 text-sm">✖ {err}</p>}
      </div>
    </div>
  );
}