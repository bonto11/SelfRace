// src/app/update-password/page.tsx
// src/app/update-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";

type Phase = "boot" | "ready" | "saving" | "done";

export default function UpdatePasswordPage() {
  const sb = getSupabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();

  const [phase, setPhase] = useState<Phase>("boot");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setErr(null);

      // 1) Náš nový stabilný flow: ?token=...&type=recovery&email=...
      const token = sp.get("token");
      const type = sp.get("type");
      const email = sp.get("email");

      if (token && type === "recovery" && email) {
        const { error } = await sb.auth.verifyOtp({
          type: "recovery",
          email,
          token,
        });
        if (error) { if (mounted) setErr(error.message); return; }

        try {
          const { data } = await sb.auth.getSession();
          if (data.session) {
            await fetch("/api/auth/set-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
            });
          }
        } catch {}
        if (mounted) setPhase("ready");
        return;
      }

      // 2) Fallback: ?code=... (niektoré projekty tak posielajú)
      const code = sp.get("code");
      if (code) {
        // najprv skús vymeniť code za session
        let ok = false;
        try {
          // @ts-ignore – tolerujeme rôzne signatúry SDK
          const res = await sb.auth.exchangeCodeForSession(code);
          ok = !res?.error;
        } catch {}
        if (!ok) {
          try {
            // @ts-ignore – novšia signatúra
            const res2 = await sb.auth.exchangeCodeForSession({ code });
            ok = !res2?.error;
          } catch {}
        }
        // ak výmena kódu zlyhá, ešte skús OTP hash (niekedy je code vlastne hash)
        if (!ok) {
          const { error } = await sb.auth.verifyOtp({
            type: "recovery",
            token_hash: code,
          } as any);
          if (error) { if (mounted) setErr(error.message); return; }
        }
        try {
          const { data } = await sb.auth.getSession();
          if (data.session) {
            await fetch("/api/auth/set-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
            });
          }
        } catch {}
        if (mounted) setPhase("ready");
        return;
      }

      // 3) Starý hash-flow (#access_token) – čakaj na session
      const { data } = await sb.auth.getSession();
      if (data.session) { if (mounted) setPhase("ready"); return; }
      const sub = sb.auth.onAuthStateChange((_e, session) => {
        if (session && mounted) setPhase("ready");
      });
      return () => sub.data.subscription.unsubscribe();
    })();

    return () => { mounted = false; };
  }, [sb, sp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (
      pwd.length < 8 ||
      !/[a-z]/.test(pwd) ||
      !/[A-Z]/.test(pwd) ||
      !/[0-9]/.test(pwd)
    ) {
      setErr("Slabé heslo (min. 8 znakov, malé + veľké písmeno a číslo).");
      return;
    }

    setPhase("saving");
    const { error } = await sb.auth.updateUser({ password: pwd });
    if (error) { setErr(error.message); setPhase("ready"); return; }

    setPhase("done");
    setTimeout(() => router.replace("/dashboard"), 800);
  }

  if (phase === "boot") {
    return (
      <div className="max-w-sm mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Zmena hesla</h1>
        <p className="opacity-80">O chvíľu ťa prihlásime a zobrazíme formulár…</p>
        {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
      </div>
    );
  }
  if (phase === "done") {
    return (
      <div className="max-w-sm mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Hotovo</h1>
        <p className="opacity-80">Heslo je zmenené. Prihlasujeme ťa…</p>
      </div>
    );
  }
  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Nastaviť nové heslo</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Nové heslo"
          required
          className="border rounded px-3 py-2"
          autoComplete="new-password"
        />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button
          type="submit"
          disabled={phase === "saving"}
          className="rounded border px-3 py-2"
        >
          {phase === "saving" ? "Ukladám…" : "Uložiť"}
        </button>
      </form>
      <p className="mt-3 text-sm opacity-70">Po uložení ťa automaticky prihlásime.</p>
    </div>
  );
}
