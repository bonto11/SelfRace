// src/features/auth/components/ChangePasswordModal.tsx
"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";
import { useRouter } from "next/navigation";

type Props = { open: boolean; onClose: () => void };

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [pwd, setPwd]   = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const router = useRouter();

  // požiadavky: 8+ znakov, aspoň 1 číslica a 1 špeciálny znak
  const policy = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  const pwdError = useMemo(() => {
    if (!pwd) return "";
    if (pwd.length < 8) return "Minimálne 8 znakov.";
    if (!/\d/.test(pwd)) return "Aspoň jedna číslica.";
    if (!/[^A-Za-z0-9]/.test(pwd)) return "Aspoň jeden špeciálny znak.";
    return "";
  }, [pwd]);

  const matchError = useMemo(() => {
    if (!pwd2) return "";
    return pwd === pwd2 ? "" : "Heslá sa nezhodujú.";
  }, [pwd, pwd2]);

  const canSave = !loading && policy.test(pwd) && pwd === pwd2;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!canSave) return;

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;

      // Odhlásiť (aj globálne, ak chceš zrušiť všetky zariadenia)
      await supabase.auth.signOut({ scope: "global" }); // alebo bez parametra len aktuálna session

      // Presmerovať na signin
      router.replace("/signin");
    } catch (err: any) {
      setMsg(err?.message ?? "Chyba pri zmene hesla");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-5 text-sm shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Zmeniť heslo</h3>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block opacity-80">Nové heslo</label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2"
              placeholder="min. 8 znakov, číslica, špec. znak"
            />
            {pwdError && <div className="mt-1 text-amber-400">{pwdError}</div>}
          </div>

          <div>
            <label className="mb-1 block opacity-80">Zopakuj heslo</label>
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2"
            />
            {matchError && <div className="mt-1 text-amber-400">{matchError}</div>}
          </div>

          {msg && <div className="rounded bg-gray-700/60 px-3 py-2">{msg}</div>}

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded bg-gray-700 px-4 py-2 hover:bg-gray-600">
              Zavrieť
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-emerald-700"
            >
              {loading ? "Ukladám…" : "Uložiť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}