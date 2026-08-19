// src/app/update-password/ClientPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  AUTH_STACK,
  AUTH_FORM,
  AUTH_FIELD,
  AUTH_LABEL,
  AUTH_FEEDBACK,
  AUTH_FEEDBACK_ERROR_STYLE,
  AUTH_PWD_ROW,
  AUTH_PWD_TOGGLE,
  AUTH_PWD_TOGGLE_STYLE,
  AUTH_METER_ROW,
  AUTH_METER_BAR,
  AUTH_METER_LABEL,
  AUTH_REQ_LIST,
  AUTH_HINT,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

type Phase = "boot" | "ready" | "saving" | "done";
type TKey = Parameters<ReturnType<typeof useT>>[0];
export default function ClientPage() {
  const sb = getSupabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();
  const t = useT();

  const [phase, setPhase] = useState<Phase>("boot");
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const email = sp.get("email") ?? "";

  useEffect(() => {
    let mounted = true;

    (async () => {
      setErr(null);

      const token = sp.get("token");
      const type = sp.get("type");
      const em = sp.get("email");

      // 1) Supabase recovery link (token + type=recovery + email)
      if (token && type === "recovery" && em) {
        const { error } = await sb.auth.verifyOtp({
          type: "recovery",
          email: em,
          token,
        });

        if (error) {
          if (mounted) setErr(error.message);
          return;
        }

        await syncSessionToServer(sb);
        if (mounted) setPhase("ready");
        return;
      }

      // 2) Magic link / PKCE variant (code v URL)
      const code = sp.get("code");
      if (code) {
        let ok = false;

        try {
          // @ts-ignore
          const r1 = await sb.auth.exchangeCodeForSession(code);
          ok = !r1?.error;
        } catch {}

        if (!ok) {
          const { error } = await sb.auth.verifyOtp({
            type: "recovery",
            token_hash: code,
          } as any);

          if (error) {
            if (mounted) setErr(error.message);
            return;
          }
        }

        await syncSessionToServer(sb);
        if (mounted) setPhase("ready");
        return;
      }

      // 3) fallback – už je prihlásený
      const { data } = await sb.auth.getSession();
      if (data.session) {
        if (mounted) setPhase("ready");
        return;
      }

            // 4) čakáme na session z onAuthStateChange
      const sub = sb.auth.onAuthStateChange((_e: any, session: any) => {
        if (session && mounted) setPhase("ready");
      });


      return () => sub.data.subscription.unsubscribe();
    })();

    return () => {
      mounted = false;
    };
  }, [sb, sp]);

  // 🔧 scorePassword je teraz čistá funkcia (žiadne hooky vo vnútri).
  // Preklady sa aplikujú tu, na top-level komponentu.
  const rawStrength = useMemo(() => computePasswordScore(pwd1, email), [pwd1, email]);

  const scoreLabels = [
    t("updatePassword.score.veryWeak"),
    t("updatePassword.score.weak"),
    t("updatePassword.score.average"),
    t("updatePassword.score.strong"),
    t("updatePassword.score.veryStrong"),
  ];

  const strength = {
    score: rawStrength.score,
    label: scoreLabels[rawStrength.score],
    hint: rawStrength.tipKeys.map((k) => t(k)).join(", "),
  };

  const match = pwd1.length > 0 && pwd1 === pwd2;
  const canSubmit = match && strength.score >= 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!canSubmit) {
      setErr(
        !match
          ? t("updatePassword.error.passwordsDontMatch")
          : t("updatePassword.error.passwordWeak"),
      );
      return;
    }

    setPhase("saving");
    const { error } = await sb.auth.updateUser({ password: pwd1 });

    if (error) {
      setErr(error.message);
      setPhase("ready");
      return;
    }

    setPhase("done");
    setTimeout(() => router.replace("/dashboard"), 600);
  }

  if (phase === "boot") {
    return (
      <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
        <div className={AUTH_SHELL}>
          <div
            className={[AUTH_CARD, AUTH_STACK].join(" ")}
            style={AUTH_CARD_STYLE}
          >
            <header className={AUTH_HEADER}>
              <h1 className={AUTH_TITLE}>
                {t("updatePassword.changePassword")}
              </h1>
              <p className={AUTH_TEXT}>{t("updatePassword.waitForLogin")}</p>
            </header>

            {err && (
              <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
                {err}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
        <div className={AUTH_SHELL}>
          <div
            className={[AUTH_CARD, AUTH_STACK].join(" ")}
            style={AUTH_CARD_STYLE}
          >
            <header className={AUTH_HEADER}>
              <h1 className={AUTH_TITLE}>{t("common.done")}</h1>
              <p className={AUTH_TEXT}>
                {t("updatePassword.changedLoggingIn")}
              </p>
            </header>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
      <div className={AUTH_SHELL}>
        <div
          className={[AUTH_CARD, AUTH_STACK].join(" ")}
          style={AUTH_CARD_STYLE}
        >
          <header className={AUTH_HEADER}>
            <h1 className={AUTH_TITLE}>{t("updatePassword.setNewPassword")}</h1>
          </header>

          <form onSubmit={submit} className={AUTH_FORM} noValidate>
            {/* New password */}
            <div className={AUTH_FIELD}>
              <label className={AUTH_LABEL}>
                {t("updatePassword.newPassword")}
              </label>

              <div className={AUTH_PWD_ROW}>
                <TextField
                  type={show ? "text" : "password"}
                  placeholder={t("updatePassword.fillNewPassword")}
                  value={pwd1}
                  onChange={(e) => setPwd1(e.currentTarget.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className={AUTH_PWD_TOGGLE}
                  style={AUTH_PWD_TOGGLE_STYLE}
                  aria-label={
                    show
                      ? t("updatePassword.showPassword")
                      : t("updatePassword.hidePassword")
                  }
                  title={
                    show
                      ? t("updatePassword.showPassword")
                      : t("updatePassword.hidePassword")
                  }
                >
                  {show ? "🙈" : "👁️"}
                </button>
              </div>

              <PasswordStrengthMeter strength={strength} />
            </div>

            {/* Confirm password */}
            <div className={AUTH_FIELD}>
              <label className={AUTH_LABEL}>
                {t("updatePassword.confirmNewPassword")}
              </label>

              <TextField
                type="password"
                placeholder={t("updatePassword.fillAgainNewPassword")}
                value={pwd2}
                onChange={(e) => setPwd2(e.currentTarget.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <RequirementsList pwd={pwd1} email={email} />

            {!match && pwd2.length > 0 && (
              <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
                {t("updatePassword.error.passwordsDontMatch")}
              </div>
            )}

            {err && (
              <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
                {err}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              block
              disabled={!canSubmit || phase === "saving"}
            >
              {phase === "saving" ? "Ukladám…" : "Uložiť"}
            </Button>

            <p className={AUTH_HINT}>{t("updatePassword.logAfterSave")}</p>
          </form>
        </div>
      </div>
    </main>
  );
}

/* ----------------- helpers (no UI hardcoding outside tokens) ----------------- */

async function syncSessionToServer(sb: ReturnType<typeof getSupabaseBrowser>) {
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "SIGNED_IN",
          session: data.session,
        }),
      });
    }
  } catch {
    /* ignore */
  }
}

function PasswordStrengthMeter({
  strength,
}: {
  strength: { score: number; label: string; hint: string };
}) {
  const steps = 5; // 0..4
  return (
    <div className={AUTH_FIELD}>
      <div className={AUTH_METER_ROW}>
        {Array.from({ length: steps }).map((_, i) => (
          <div
            key={i}
            className={[
              AUTH_METER_BAR,
              i < strength.score ? "bg-success" : "bg-surface",
              "border-border",
            ].join(" ")}
          />
        ))}
      </div>

      <div className={[AUTH_METER_LABEL, "text-muted"].join(" ")}>
        Sila hesla:{" "}
        <span className="text-text font-medium">{strength.label}</span>
        {strength.hint && (
          <span className="opacity-80"> — {strength.hint}</span>
        )}
      </div>
    </div>
  );
}

function RequirementsList({ pwd, email }: { pwd: string; email: string }) {
  const t = useT();
  const reqs = [
    { ok: pwd.length >= 8, text: t("updatePassword.criteria.atLeastChar") },
    { ok: /[a-z]/.test(pwd), text: t("updatePassword.criteria.atLeast1Small") },
    { ok: /[A-Z]/.test(pwd), text: t("updatePassword.criteria.atLeast1Big") },
    { ok: /[0-9]/.test(pwd), text: t("updatePassword.criteria.atLeast1Num") },
    {
      ok: /[^A-Za-z0-9]/.test(pwd),
      text: t("updatePassword.criteria.atLeast1Special"),
    },
    {
      ok: email
        ? !pwd.toLowerCase().includes(email.split("@")[0]!.toLowerCase())
        : true,
      text: "neobsahuje tvoje meno/e-mail",
    },
  ];

  return (
    <ul className={AUTH_REQ_LIST}>
      {reqs.map((r, i) => (
        <li key={i} className={r.ok ? "text-success" : "text-muted"}>
          {r.ok ? "✓" : "•"} {r.text}
        </li>
      ))}
    </ul>
  );
}

// 🔧 Čistá funkcia — žiadne hooky, žiadne t(). Vracia score a zoznam
// tip-kľúčov (nie preložený text), aby sa dala bezpečne volať z useMemo.
function computePasswordScore(
  pwd: string,
  email?: string,
): { score: number; tipKeys: TKey[] } {
  const len = pwd.length;

  let score = 0;
  if (len >= 8) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (len >= 12) score++;

  const lowers = pwd.toLowerCase();
  const local = (email || "").split("@")[0]?.toLowerCase() || "";
  if (local && lowers.includes(local)) score = Math.max(0, score - 1);
  if (/^(1234|qwer|asdf|zxcv)/i.test(pwd)) score = Math.max(0, score - 1);
  if (/^([a-zA-Z0-9])\1+$/.test(pwd)) score = Math.max(0, score - 2);

  score = Math.max(0, Math.min(4, score));

  const tipKeys: TKey[] = [];
  if (score < 3) {
    if (len < 12) tipKeys.push("updatePassword.tips.atLeastChar");
    if (!/[A-Z]/.test(pwd)) tipKeys.push("updatePassword.tips.atLeast1Small");
    if (!/[a-z]/.test(pwd)) tipKeys.push("updatePassword.tips.atLeast1Big");
    if (!/[0-9]/.test(pwd)) tipKeys.push("updatePassword.tips.atLeast1Num");
    if (!/[^A-Za-z0-9]/.test(pwd))
      tipKeys.push("updatePassword.tips.atLeast1Special");
    if (local && lowers.includes(local))
      tipKeys.push("updatePassword.tips.noMainName");
  }

  return { score, tipKeys };
}