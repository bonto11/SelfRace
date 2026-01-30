// src/app/features/auth/components/SignUpForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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

export default function SignUpForm() {
  const sb = getSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isOk, setIsOk] = useState<boolean>(false);

  // ✅ explicit consent
  const [agreeRisk, setAgreeRisk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // hard gate (aj keby niekto hackol disabled)
    if (!agreeRisk) {
      toast.error("Prosím potvrď, že rozumieš podmienkam používania.");
      return;
    }

    setBusy(true);
    setMsg(null);
    setIsOk(false);

    const { error } = await sb.auth.signUp({
      email,
      password: pwd,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/coach`,
      },
    });

    setBusy(false);

    if (error) {
      const m = error.message || "Registrácia zlyhala.";
      toast.error(m);
      setMsg(m);
      setIsOk(false);
      return;
    }

    const okMsg = "Skontroluj e-mail a potvrď registráciu.";
    setMsg(okMsg);
    setIsOk(true);
    toast.success(okMsg);
  }

  const canSubmit = !busy && agreeRisk;

  return (
    <AuthShell
      title="Vytvoriť účet"
      description="Sleduj tréningy, analyzuj dáta a nechaj AI pripraviť plán na mieru."
    >
      <form onSubmit={submit} className={AUTH_FORM}>
        <div className={AUTH_FIELD}>
          <TextField
            placeholder="Meno (voliteľné)"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="email"
            placeholder="tvoje@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            autoComplete="email"
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="password"
            placeholder="Heslo (min. 6 znakov)"
            required
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
            autoComplete="new-password"
          />
        </div>

        {/* ✅ legal line (pod heslom, nad checkboxom/submitom) */}
        <div
          className="text-[11px] leading-relaxed"
          style={{ color: appColors.textMuted }}
        >
          By clicking Sign Up, you agree to our{" "}
          <Link
            href="/terms"
            className={AUTH_LINK}
            style={AUTH_LINK_MUTED_STYLE}
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className={AUTH_LINK}
            style={AUTH_LINK_MUTED_STYLE}
          >
            Privacy Policy
          </Link>
          .
        </div>

        {/* ✅ explicitný checkbox (must-check) */}
        <label
          className={CHECKBOX_ROW}
          style={{ ...(FORM_TEXT_VARS as any), ...(CHECKBOX_BOX_EDITABLE_STYLE as any) }}
        >
          <input
            type="checkbox"
            className={CHECKBOX_BOX_EDITABLE}
            checked={agreeRisk}
            onChange={(e) => setAgreeRisk(e.currentTarget.checked)}
          />
          <span className={CHECKBOX_LABEL} style={{ color: appColors.textSecondary }}>
            I understand that SelfRace is not a medical tool and I use the
            training insights at my own risk.
            <span className={CHECKBOX_HINT}>
              (Required to create an account)
            </span>
          </span>
        </label>

        {msg ? (
          <div
            className={AUTH_FEEDBACK}
            style={isOk ? AUTH_FEEDBACK_SUCCESS_STYLE : AUTH_FEEDBACK_ERROR_STYLE}
          >
            {msg}
          </div>
        ) : null}

        {/* ✅ disabled kým nie je checkbox */}
        <Button type="submit" variant="primary" block disabled={!canSubmit}>
          {busy ? "Vytváram…" : "Registrovať"}
        </Button>

        <div className={["text-xs text-center", AUTH_TEXT].join(" ")}>
          Už máš účet?{" "}
          <Link
            className={AUTH_LINK}
            href="/signin"
            style={AUTH_LINK_MUTED_STYLE}
          >
            Prihlás sa
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
          Stravu prepojíš po registrácii v sekcii Connected Apps.
        </p>
      </form>
    </AuthShell>
  );
}