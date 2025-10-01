// src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";

export default function SignUpPage() {
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
    setMsg(error ? error.message : "Skontroluj e-mail a potvrď registráciu.");
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Vytvoriť účet</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full rounded-md bg-slate-900 px-3 py-2"
          placeholder="Meno (voliteľné)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          required
          type="email"
          className="w-full rounded-md bg-slate-900 px-3 py-2"
          placeholder="tvoje@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          type="password"
          className="w-full rounded-md bg-slate-900 px-3 py-2"
          placeholder="Heslo (min. 6 znakov)"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
        <button
          disabled={busy}
          className="w-full rounded-md bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-50"
        >
          {busy ? "Vytváram…" : "Registrovať"}
        </button>
      </form>

      <div className="text-sm text-white/60">
        Už máš účet?{" "}
        <Link className="underline" href="/signin">
          Prihlás sa
        </Link>
      </div>

      {msg && <div className="text-sm text-white/80">{msg}</div>}
    </div>
  );
}