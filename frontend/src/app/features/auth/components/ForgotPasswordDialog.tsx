// src/features/auth/components/ForgotPasswordDialog.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { CARD, SIDEBAR_OVERLAY } from "@/app/shared/ui/uiTokens";
import { THEME } from "@/app/shared/theme/tokens";
import { toast } from "@/app/shared/components/ui/Toast";

type Props = { open: boolean; onClose: () => void };

export default function ForgotPasswordDialog({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const supabase = getSupabaseBrowser();
  if (!open) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/update-password` }
      );
      if (error) throw error;
      toast.info("✔️ Poslali sme ti e-mail s odkazom na zmenu hesla.");
    } catch (e: any) {
      toast.error(e?.message ?? "Nepodarilo sa odoslať reset e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={`${SIDEBAR_OVERLAY} grid place-items-center p-4`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`${CARD} w-full max-w-md p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base md:text-lg font-semibold">
            Zabudnuté heslo
          </h3>
          <button
            onClick={onClose}
            className="text-sm opacity-70 hover:opacity-100"
            aria-label="Zavrieť"
            title="Zavrieť"
            style={{ color: THEME.chart.linePrimary }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <TextField
            type="email"
            required
            placeholder="tvoj@email.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />

          <Button
            type="submit"
            disabled={!email.trim() || sending}
            className="w-full"
          >
            {sending ? "Odosielam…" : "Poslať reset link"}
          </Button>
        </form>

        {msg && <p className="mt-3 text-emerald-400 text-sm">{msg}</p>}
        {err && <p className="mt-3 text-red-400 text-sm">✖ {err}</p>}
      </div>
    </div>
  );
}
