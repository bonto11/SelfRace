// src/app/features/auth/components/SignUpForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  AUTH_FEEDBACK_SUCCESS_STYLE,
  AUTH_FEEDBACK_ERROR_STYLE,
  AUTH_LINK,
  AUTH_LINK_MUTED_STYLE,
  AUTH_TEXT,
} from "@/app/shared/ui/tokens/auth";

import {
  CHECKBOX_ROW,
  CHECKBOX_BOX_EDITABLE,
  CHECKBOX_BOX_EDITABLE_STYLE,
  CHECKBOX_LABEL,
  CHECKBOX_HINT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens/inputs";
import { useT } from "@/app/shared/i18n/useT";
import GoogleSignInButton, { AuthOrDivider } from "./GoogleSignInButton";
import { trackRegistration } from "@/app/shared/analytics/metaPixel";

/** Číslo kroku (1 súhlas, 2 registrácia) – nech je jasné poradie. */
function StepTitle({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: appColors.brandPrimary, color: appColors.buttonPrimaryText }}
      >
        {n}
      </span>
      <span className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
        {text}
      </span>
    </div>
  );
}

export default function SignUpForm() {
  const sb = getSupabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isOk, setIsOk] = useState<boolean>(false);
  const t = useT();

  // explicit consent
  const [agreeRisk, setAgreeRisk] = useState(false);
  // zvýrazní krok 1, keď user klikne na registráciu bez súhlasu
  const [needConsent, setNeedConsent] = useState(false);

  function askConsent() {
    setNeedConsent(true);
    toast.error(t("signUp.confirmFirst"));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!agreeRisk) {
      askConsent();
      return;
    }

    setBusy(true);
    setMsg(null);
    setIsOk(false);

    const { data, error } = await sb.auth.signUp({
      email,
      password: pwd,
      options: {
        data: { full_name: name },
        // Návratová adresa po kliknutí na link v maily — spracuje token
        // cez verifyOtp na /confirm-email a až potom presmeruje na /signin.
        emailRedirectTo: `${window.location.origin}/confirm-email`,
      },
    });

    setBusy(false);

    if (error) {
      const m = error.message || t("signUp.registerFailed");
      toast.error(m);
      setMsg(m);
      setIsOk(false);
      return;
    }

    // Existujúci e-mail Supabase vráti bez identít (nevyzradí, že účet existuje) –
    // to nie je nová registrácia.
    if (data?.user?.identities?.length) trackRegistration("email");

    // Ak Supabase rovno vytvoril aktívnu session (tzv. "Auto Confirm" je ON v Supabase)
    if (data?.session) {
      router.replace("/dashboard");
      return;
    }

    // Ak používateľ musí ešte potvrdiť email (Auto Confirm je OFF v Supabase)
    const okMsg = t("signUp.registerCheckMail");
    setMsg(okMsg);
    setIsOk(true);
    toast.success(okMsg);
  }

  return (
    <AuthShell
      title={t("signUp.registerTitle")}
      description={t("signUp.registerDescription")}
    >
      <form onSubmit={submit} className={AUTH_FORM}>
        {/* PREČO súhlas ako krok 1 hore: pod e-mailom vyzeral ako súčasť e-mailovej
            registrácie a Google tlačidlo pod ním bolo zablokované bez vysvetlenia. */}
        <StepTitle n={1} text={t("signUp.step1")} />

        <label
          className={CHECKBOX_ROW}
          style={{
            ...(FORM_TEXT_VARS as any),
            ...(CHECKBOX_BOX_EDITABLE_STYLE as any),
            ...(needConsent && !agreeRisk
              ? { outline: `2px solid ${appColors.statusWarning}`, outlineOffset: 6, borderRadius: 12 }
              : null),
          }}
        >
          <input
            type="checkbox"
            className={CHECKBOX_BOX_EDITABLE}
            checked={agreeRisk}
            onChange={(e) => setAgreeRisk(e.currentTarget.checked)}
          />
          <span
            className={CHECKBOX_LABEL}
            style={{ color: appColors.textSecondary }}
          >
            {t("signUp.confirmMedical")}

            <span className={CHECKBOX_HINT}>
              {t("signUp.confirmMedicalHint")}
            </span>
          </span>
        </label>

        <div
          className="text-[11px] leading-relaxed"
          style={{ color: appColors.textMuted }}
        >
          {t("signUp.termsDesc")}{" "}
          <Link
            href="/terms"
            className={AUTH_LINK}
            style={AUTH_LINK_MUTED_STYLE}
          >
            {t("signUp.termsTitle")}
          </Link>{" "}
          {t("common.and")}{" "}
          <Link
            href="/privacy"
            className={AUTH_LINK}
            style={AUTH_LINK_MUTED_STYLE}
          >
            {t("signUp.privacyTitle")}
          </Link>
          .
        </div>

        <StepTitle n={2} text={t("signUp.step2")} />

        {/* bez súhlasu Google neštartuje – tlačidlo je aktívne, aby bolo jasné prečo */}
        <GoogleSignInButton
          disabled={busy}
          onBeforeStart={() => {
            if (agreeRisk) return true;
            askConsent();
            return false;
          }}
        />

        <AuthOrDivider />

        <div className={AUTH_FIELD}>
          <TextField
            placeholder={t("signUp.registerPlaceholder")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="email"
            placeholder={t("signUp.registerMail")}
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="password"
            placeholder={t("signUp.registerPassword")}
            required
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
            autoComplete="new-password"
          />
        </div>

        {msg ? (
          <div
            className={AUTH_FEEDBACK}
            style={
              isOk ? AUTH_FEEDBACK_SUCCESS_STYLE : AUTH_FEEDBACK_ERROR_STYLE
            }
          >
            {msg}
          </div>
        ) : null}

        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? t("signUp.registering") : t("signUp.register")}
        </Button>

        <div className={["text-xs text-center", AUTH_TEXT].join(" ")}>
          {t("signUp.haveAccount")}{" "}
          <Link
            className={AUTH_LINK}
            href="/signin"
            style={AUTH_LINK_MUTED_STYLE}
          >
            {t("signUp.btnSignin")}
          </Link>
        </div>

        {/* Strava branding (SVG, compliant) */}
        <div className="mt-6 flex justify-center">
          <Image
            src={STRAVA_ASSETS.poweredBySvg_white}
            alt="Powered by Strava"
            width={190}
            height={24}
            style={{ height: 16, width: "auto", opacity: 0.9 }}
          />
        </div>

        <p
          className="mt-2 text-[11px] text-center"
          style={{ color: appColors.textMuted }}
        >
          {t("signUp.footer")}
        </p>
      </form>
    </AuthShell>
  );
}