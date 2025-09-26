// src/app/(auth)/update-password/page.tsx
// Stránka po kliknutí na reset-link z e-mailu. Po úspechu odhlási FE aj server a presmeruje na /signin.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/shared/hooks/supabaseClient";

function validatePassword(p: string) {
  if (p.length < 8) return "Minimálne 8 znakov.";
  if (!/[0-9]/.test(p)) return "Aspoň jedna číslica.";
  if (!/[!@#$%^&*()_\-+=\[{\]}|\\:;\"'<>,.?/]/.test(p))
    return "Aspoň jeden špeciálny znak.";
  return null;
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
          setEmail(session?.user?.email ?? null);
        }
      });
      unsub = () => sub.subscription.unsubscribe();

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        setEmail(data.session.user?.email ?? null);
      }
    })();
    return () => unsub();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validatePassword(pwd);
    if (v) return setErr(v);
    if (pwd !== pwd2) return setErr("Heslá sa nezhodujú.");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;

      await supabase.auth.signOut().catch(() => {});
      await fetch("/api/auth/signout", { method: "POST", cache: "no-store" }).catch(() => {});
      router.replace("/signin");
      setTimeout(() => { window.location.href = "/signin"; }, 20);

    } catch (e: any) {
      setErr(e?.message ?? "Nepodarilo sa zmeniť heslo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded p-6 shadow">
        <h1 className="text-xl font-bold mb-4">Nastaviť nové heslo</h1>

        {!ready ? (
          <>
            <p className="text-sm opacity-80">
              ✉️ Otvor <b>odkaz z e-mailu</b> pre reset hesla. Ak si sem prišiel
              manuálne, najprv na stránke <i>Sign in</i> klikni „Forgot password“,
              zadaj e-mail a použi link z mailu.
            </p>
            <p className="mt-3 text-red-400 text-sm">✖ Auth session missing!</p>
          </>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            {email && <div className="text-sm opacity-80">Účet: <b>{email}</b></div>}
            <input type="password" placeholder="Nové heslo" value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2" />
            <input type="password" placeholder="Zopakuj nové heslo" value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2" />
            <button type="submit" disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded px-3 py-2 disabled:opacity-50">
              {saving ? "Ukladám…" : "Uložiť heslo"}
            </button>
            {err && <p className="text-red-400 text-sm mt-2">✖ {err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}