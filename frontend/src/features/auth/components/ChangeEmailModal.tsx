// src/features/auth/components/ChangeEmailModal.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChangeEmailModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email) return;

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      // Supabase pošle verifikačný email na novú adresu
      setMsg("Overovací email bol odoslaný na novú adresu ✅");
      // onClose(); // ak chceš zavrieť hneď
    } catch (err: any) {
      setMsg(err?.message ?? "Chyba pri zmene e-mailu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-5 text-sm shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Zmeniť e-mail</h3>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block opacity-80">Nový e-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2"
              placeholder="name@example.com"
            />
          </div>

          {msg && <div className="rounded bg-gray-700/60 px-3 py-2">{msg}</div>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-gray-700 px-4 py-2 hover:bg-gray-600"
            >
              Zavrieť
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-emerald-700"
            >
              {loading ? "Odosielam…" : "Potvrdiť"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}