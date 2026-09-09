"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { toast } from "@/app/shared/ui/components/Toast";
import AuthShell from "@/app/shared/ui/components/AuthShell";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  AUTH_FORM,
  AUTH_FIELD,
  AUTH_FEEDBACK,
  AUTH_FEEDBACK_INFO_STYLE,
  AUTH_FEEDBACK_ERROR_STYLE,
  AUTH_LINK_ROW,
  AUTH_LINK,
  AUTH_LINK_STYLE,
  AUTH_LINK_MUTED_STYLE,
  AUTH_TEXT,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

export default function SignInForm() {
  const t = useT();
  const router = useRouter();
  const sb = useMemo(() => getSupabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [confirmInfo, setConfirmInfo] = useState<string | null>(null);

  const sp = useSearchParams();
  const info = sp.get("checkEmail") === "1" ? t("signIn.checkMail") : null;

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const token = sp.get("token");
      const type = sp.get("type");
      const emailParam = sp.get("email");

      // 🛡️ Prišli sme z potvrdzovacieho mailu (signup)
      if (token && type === "signup" && emailParam) {
        const { error } = await sb.auth.verifyOtp({
          type: "signup",
          email: emailParam,
          token,
        });

        // verifyOtp nás potichu prihlási — to nechceme, chceme vždy manuálny login
        await sb.auth.signOut();

        // vyčistíme URL, nech tam nezostanú tokeny
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.search = "";
          url.hash = "";
          window.history.replaceState({}, "", url.toString());
        }

        if (mounted) {
          if (error) {
            setErr(error.message || t("signIn.loginFailed"));
          } else {
            setConfirmInfo(t("signIn.checkMail")); // alebo vlastný string "Email potvrdený, prihlás sa"
            setEmail(emailParam);
          }
          setIsAuthChecking(false);
        }
        return;
      }

      // Bežný vstup na /signin — ak už existuje reálna session, hoď ho do appky
      const { data } = await sb.auth.getSession();
      if (data.session?.user) {
        router.replace("/activities");
      } else if (mounted) {
        setIsAuthChecking(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [router, sb, sp, t]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pwd,
    });

    setLoading(false);

    if (error) {
      const msg = error.message || t("signIn.loginFailed");
      setErr(msg);
      toast.error(msg);
      return;
    }

    router.replace("/activities");
  }

  // 🛡️ Splash screen vo farbách aplikácie
  if (isAuthChecking) {
    return <div style={{ minHeight: "100dvh", background: appColors.backgroundMain }} />;
  }

  const isSubmitDisabled = loading || !email.trim() || !pwd.trim();

  return (
    <AuthShell
      title={t("signIn.loginTitle")}
      description={t("signIn.loginDescription")}
    >
      <form onSubmit={submit} className={AUTH_FORM}>
        {confirmInfo ? (
          <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_INFO_STYLE}>
            {confirmInfo}
          </div>
        ) : info ? (
          <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_INFO_STYLE}>
            {info}
          </div>
        ) : null}

        <div className={AUTH_FIELD}>
          <TextField
            type="email"
            placeholder={t("signIn.loginPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="password"
            placeholder={t("signIn.loginPassword")}
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        {err ? (
          <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
            {err}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          block
          disabled={isSubmitDisabled}
        >
          {loading ? t("signIn.logingIn") : t("signIn.logIn")}
        </Button>

        <div className={AUTH_LINK_ROW}>
          <Link
            href="/forgot-password"
            className={AUTH_LINK}
            style={AUTH_LINK_STYLE}
          >
            {t("signIn.btnForgotPassword")}
          </Link>

          <span className={AUTH_TEXT}>
            {t("signIn.haveAccount")}
            <Link
              href="/signup"
              className={AUTH_LINK}
              style={AUTH_LINK_MUTED_STYLE}
            >
              {t("signIn.btnRegister")}
            </Link>
          </span>
        </div>

        <div className="mt-6 flex justify-center">
          <Image
            src={STRAVA_ASSETS.poweredBySvg_white}
            alt="Powered by Strava"
            width={190}
            height={24}
            style={{
              height: 16,
              width: "auto",
              opacity: 0.9,
              filter: "none",
            }}
          />
        </div>
        <p
          className="mt-2 text-[11px] text-center"
          style={{ color: appColors.textMuted }}
        >
          {t("signIn.footer")}
        </p>

        <a
          href="/debug"
          className="text-xs text-gray-500 mt-4 block text-center"
        >
          Diagnostika PWA
        </a>
      </form>
    </AuthShell>
  );
}