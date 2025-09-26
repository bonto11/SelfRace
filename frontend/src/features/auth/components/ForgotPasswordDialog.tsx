// src/features/auth/components/ForgotPasswordDialog.tsx (alebo kde to máš)
"use client";

import { useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";

type Props = { open: boolean; onClose: () => void };

export default function ForgotPasswordDialog({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/update-password` }
      );
      if (error) throw error;
      setMsg("✔️ Poslali sme ti e-mail s odkazom na zmenu hesla.");
    } catch (e: any) {
      setErr(e?.message ?? "Nepodarilo sa odoslať reset e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Zabudnuté heslo</h3>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Tvoj e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
          />
          <button
            type="submit"
            disabled={!email.trim() || sending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 disabled:opacity-50"
          >
            {sending ? "Odosielam…" : "Poslať reset link"}
          </button>
        </form>

        {msg && <p className="mt-3 text-green-400 text-sm">{msg}</p>}
        {err && <p className="mt-3 text-red-400 text-sm">✖ {err}</p>}
      </div>
    </div>
  );
}