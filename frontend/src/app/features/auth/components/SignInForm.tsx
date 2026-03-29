"use client";

import React, { useState, useMemo } from "react"; // Removed useEffect
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

  const sp = useSearchParams();
  const info = sp.get("checkEmail") === "1" ? t("signIn.checkMail") : null;

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

    // Next.js router handles the navigation, and the new cookie should be picked up
    router.replace("/activities");
  }

  const isSubmitDisabled = loading || !email.trim() || !pwd.trim();

  return (
    <AuthShell
      title={t("signIn.loginTitle")}
      description={t("signIn.loginDescription")}
    >
      <form onSubmit={submit} className={AUTH_FORM}>
        {info ? (
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
            disabled={loading} // Changed from isClearing
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
            disabled={loading} // Changed from isClearing
          />
        </div>

        {err ? (
          <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
            {err}
          </div>
        ) : null}

        <Button type="submit" variant="primary" block disabled={isSubmitDisabled}>
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
      </form>
    </AuthShell>
  );
}
