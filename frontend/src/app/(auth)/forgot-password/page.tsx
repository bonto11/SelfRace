// src/app/(auth)/forgot-password/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";

import {
  AUTH_PAGE,
  AUTH_PAGE_PAD,
  AUTH_SHELL,
  AUTH_CARD,
  AUTH_CARD_STYLE,
  AUTH_HEADER,
  AUTH_TITLE,
  AUTH_TEXT,
  AUTH_FIELD,
  AUTH_LABEL,
  AUTH_NOTICE,
  AUTH_NOTICE_SUCCESS_STYLE,
  AUTH_NOTICE_ERROR_STYLE,
} from "@/app/shared/ui/tokens/auth";
import { FRONTEND_URL } from "@/app/shared/config";
import { useT } from "@/app/shared/i18n/useT";

export default function ForgotPasswordPage() {
  const sb = getSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const t = useT();

  async function submit(e: React.FormEvent) {

    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr(t("forgotPassword.fillValidMail"));
      return;
    }

    setSending(true);
    try {
      const origin = FRONTEND_URL || window.location.origin;
      const redirectTo = `${origin}/update-password`;

      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;

      setMsg(
        t("forgotPassword.sentMail")
      );
    } catch (e: any) {
      setErr(e?.message || t("forgotPassword.errorSent"));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
      <div className={AUTH_SHELL}>
        <form onSubmit={submit} className={AUTH_CARD} style={AUTH_CARD_STYLE}>
          <header className={AUTH_HEADER}>
            <h1 className={AUTH_TITLE}>{t("forgotPassword.forgotPassword")}</h1>
            <p className={AUTH_TEXT}>
              {t("forgotPassword.fillYourMail")}
            </p>
          </header>

          <div className={AUTH_FIELD}>
            <label className={AUTH_LABEL}>{t("forgotPassword.mail")}</label>
            <TextField
              type="email"
              placeholder={t("forgotPassword.yourMail")}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="email"
              required
            />
          </div>

          {msg && (
            <div className={AUTH_NOTICE} style={AUTH_NOTICE_SUCCESS_STYLE}>
              {msg}
            </div>
          )}

          {err && (
            <div className={AUTH_NOTICE} style={AUTH_NOTICE_ERROR_STYLE}>
              {err}
            </div>
          )}

          <Button type="submit" variant="primary" block disabled={sending}>
            {sending ? t("forgotPassword.sending") : t("forgotPassword.sentResetMail")}
          </Button>
        </form>
      </div>
    </main>
  );
}
