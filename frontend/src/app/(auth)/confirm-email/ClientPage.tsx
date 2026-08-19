// src/app/confirm-email/ClientPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

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
  AUTH_FEEDBACK,
  AUTH_FEEDBACK_ERROR_STYLE,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

type Phase = "verifying" | "success" | "error";

export default function ClientPage() {
  const sb = getSupabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();
  const t = useT();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = sp.get("token");
      const type = sp.get("type");
      const email = sp.get("email");

      // 1) Manuálny signup token (rovnaký princíp ako recovery pri update-password)
      if (token && type === "signup" && email) {
        const { error } = await sb.auth.verifyOtp({
          type: "signup",
          email,
          token,
        });

        if (error) {
          if (mounted) {
            setErr(error.message);
            setPhase("error");
          }
          return;
        }

        await syncSessionToServer(sb);
        if (mounted) setPhase("success");
        setTimeout(() => router.replace("/activities"), 600);
        return;
      }

      // 2) Fallback — PKCE code (ak by niekedy prišiel aj tento formát)
      const code = sp.get("code");
      if (code) {
        try {
          // @ts-ignore
          const r1 = await sb.auth.exchangeCodeForSession(code);
          if (r1?.error) throw r1.error;
          await syncSessionToServer(sb);
          if (mounted) setPhase("success");
          setTimeout(() => router.replace("/activities"), 600);
          return;
        } catch (e: any) {
          if (mounted) {
            setErr(e?.message || t("confirmEmail.error.generic"));
            setPhase("error");
          }
          return;
        }
      }

      // 3) Už je prihlásený (napr. druhé kliknutie na ten istý link)
      const { data } = await sb.auth.getSession();
      if (data.session) {
        if (mounted) setPhase("success");
        setTimeout(() => router.replace("/activities"), 600);
        return;
      }

      if (mounted) {
        setErr(t("confirmEmail.error.missingParams"));
        setPhase("error");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sb, sp, router, t]);

  return (
    <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
      <div className={AUTH_SHELL}>
        <div className={[AUTH_CARD, AUTH_STACK].join(" ")} style={AUTH_CARD_STYLE}>
          <header className={AUTH_HEADER}>
            <h1 className={AUTH_TITLE}>
              {phase === "success"
                ? t("confirmEmail.success")
                : t("confirmEmail.title")}
            </h1>
            <p className={AUTH_TEXT}>
              {phase === "verifying" && t("confirmEmail.verifying")}
              {phase === "success" && t("confirmEmail.redirecting")}
              {phase === "error" && t("confirmEmail.errorHint")}
            </p>
          </header>

          {err && phase === "error" && (
            <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
              {err}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ----------------- helpers ----------------- */

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