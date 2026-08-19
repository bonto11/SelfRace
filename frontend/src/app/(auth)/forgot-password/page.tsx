// src/app/(auth)/forgot-password/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
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
import { appColors } from "@/app/shared/ui/theme/app_colors";
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
        <form
          onSubmit={submit}
          className={[AUTH_CARD, "space-y-6"].join(" ")}
          style={AUTH_CARD_STYLE}
        >
          <header className={[AUTH_HEADER, "space-y-2"].join(" ")}>
            <h1 className={AUTH_TITLE}>{t("forgotPassword.forgotPassword")}</h1>
            <p className={AUTH_TEXT}>
              {t("forgotPassword.fillYourMail")}
            </p>
          </header>

          <div className={[AUTH_FIELD, "space-y-2"].join(" ")}>
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

          <div className="pt-2 flex flex-col items-center gap-3 text-sm">
            <Link
              href="/signin"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold transition-colors w-full"
              style={{
                background: appColors.buttonGhostBg,
                color: appColors.textPrimary,
                border: `1px solid ${appColors.surfaceCardBorder}`,
              }}
            >
              {t("forgotPassword.backToSignIn")}
            </Link>

            <Link
              href="/"
              className="hover:underline transition-all"
              style={{ color: appColors.textSecondary }}
            >
              {t("forgotPassword.backToHome")}
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}