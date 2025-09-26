// src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";

function validatePassword(p: string) {
  if (p.length < 8) return "Minimálne 8 znakov.";
  if (!/[0-9]/.test(p)) return "Aspoň jedna číslica.";
  if (!/[!@#$%^&*()_\-+\[\]{}|\\:;\"'<>,.?/]/.test(p)) return "Aspoň jeden špeciálny znak.";
  return null;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setMsg(null);
    setErr(null);
    const v = validatePassword(pass);
    if (v) { setErr(v); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
    setLoading(false);
    if (error) setErr(error.message);
    else setMsg("✅ Check your email to confirm your account.");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded p-6 space-y-4 shadow">
        <h1 className="text-xl font-bold">Sign up</h1>
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700"
          placeholder="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="new-password"
        />
        <button
          className="w-full bg-green-600 hover:bg-green-700 rounded py-2 text-white disabled:opacity-50"
          disabled={loading}
          onClick={handleSignup}
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        {err && <div className="text-sm text-red-400">{err}</div>}
        {msg && <div className="text-sm opacity-80">{msg}</div>}
      </div>
    </div>
  );
}