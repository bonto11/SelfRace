// src/features/auth/components/ChangeEmailModal.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

// UI systém
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { SURFACE_SUBCARD } from "@/app/shared/theme/uiTokens";

type Props = { open: boolean; onClose: () => void };

export default function ChangeEmailModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const supabase = getSupabaseBrowser();
  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setMsg("Overovací email bol odoslaný na novú adresu ✅");
    } catch (err: any) {
      setMsg(err?.message ?? "Chyba pri zmene e-mailu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4">
      <div className={`${SURFACE_SUBCARD} w-full max-w-md p-5 text-sm`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Zmeniť e-mail</h3>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block opacity-80 text-xs">Nový e-mail</label>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          {msg && (
            <div className="rounded border border-white/10 bg-white/5 px-3 py-2">
              {msg}
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Zavrieť
            </Button>
            <Button
              type="submit"
              variant="success"
              size="sm"
              disabled={loading || !email}
            >
              {loading ? "Odosielam…" : "Potvrdiť"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
