// src/app/(auth)/update-password/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/shared/utils/supabaseBrowser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

function passwordScore(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return Math.min(score, 5);
}

export default function UpdatePasswordPage() {
  const sb = getSupabaseBrowser();
  const router = useRouter();

  const [allowed, setAllowed] = useState(false); // stránka dostupná pri session (prihlásený alebo recovery)
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const strength = useMemo(() => passwordScore(pwd), [pwd]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    (async () => {
      // 1) ak si PRIHlÁSENÝ → povolíme rovno
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session) setAllowed(true);

      // 2) ak prídeš z mailu (recovery), supabase vyvolá PASSWORD_RECOVERY a tiež povolíme
      const { data } = sb.auth.onAuthStateChange(
        (event: AuthChangeEvent, _session: Session | null) => {
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setAllowed(true);
          }
        }
      );
      unsubscribe = data.subscription.unsubscribe;
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sb]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (pwd !== pwd2) {
      setErr("Heslá sa nezhodujú.");
      return;
    }
    // minimálne požiadavky – 8 znakov a aspoň 3 typy znakov
    const classesOK = [/[0-9]/, /[a-z]/, /[A-Z]/, /[^A-Za-z0-9]/].filter((r) =>
      r.test(pwd)
    ).length;
    if (pwd.length < 8 || classesOK < 3) {
      setErr("Heslo musí mať min. 8 znakov a aspoň 3 typy znakov.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await sb.auth.updateUser({ password: pwd });
      if (error) throw error;

      setMsg("Heslo bolo zmenené. Môžeš sa prihlásiť.");
      // po pár sekundách späť na /signin
      setTimeout(() => router.replace("/signin"), 1200);
    } catch (e: any) {
      setErr(e?.message ?? "Nepodarilo sa zmeniť heslo.");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    // Bez session – používateľ by sem nemal prísť priamo: nech ho navigujeme
    return (
      <div className="mx-auto max-w-sm p-4">
        <h1 className="text-xl font-semibold mb-3">Zmena hesla</h1>
        <p className="text-sm opacity-80">
          Pre zmenu hesla sa prihlás alebo použij link z e-mailu{" "}
          <em>Reset password</em>.
        </p>
        <a className="inline-block mt-4 underline" href="/signin">
          Späť na prihlásenie
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-4">
      <h1 className="text-xl font-semibold mb-4">Zmeniť heslo</h1>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Nové heslo</label>
          <input
            type="password"
            className="w-full rounded border bg-transparent px-3 py-2"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoFocus
          />
          <div className="text-xs mt-1 opacity-70">
            Sila:{" "}
            <span>
              {["slabé", "ok", "dobré", "silné", "veľmi silné"][
                Math.max(0, strength - 1)
              ] || "slabé"}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Nové heslo znova</label>
          <input
            type="password"
            className="w-full rounded border bg-transparent px-3 py-2"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
          />
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}
        {msg && <div className="text-sm text-green-400">{msg}</div>}

        <button
          type="submit"
          className="rounded bg-white/10 px-3 py-2 hover:bg-white/15 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Ukladám…" : "Uložiť nové heslo"}
        </button>
      </form>
    </div>
  );
}