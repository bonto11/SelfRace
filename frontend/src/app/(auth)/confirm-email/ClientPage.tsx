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

/**
 * 🛡️ Obchádza "tichý štít" v supabaseBrowser.ts, ktorý blokuje
 * storage.removeItem() pre auth-token kľúč (a teda aj sb.auth.signOut()
 * ho reálne nezmaže). Pracuje priamo s natívnym window.localStorage,
 * takže wrapper vôbec neobíde — je to jediný spôsob, ako z tohto flow
 * garantovane odstrániť session zo signup-verifikácie bez zásahu
 * do zdieľaného supabaseBrowser.ts.
 */
function hardClearSupabaseSession() {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("sb-") && k.includes("auth-token"))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

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

      // 1) Manuálny signup token
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
          setTimeout(() => router.replace("/signin"), 3000);
          return;
        }

        // verifyOtp nás potichu prihlási — nechceme aktívnu session,
        // user sa má vždy prihlásiť manuálne cez /signin (heslom).
        await sb.auth.signOut();
        hardClearSupabaseSession();

        if (mounted) setPhase("success");
        setTimeout(() => router.replace("/signin"), 2200);
        return;
      }

      // 2) Fallback — PKCE code
      const code = sp.get("code");
      if (code) {
        try {
          // @ts-ignore
          const r1 = await sb.auth.exchangeCodeForSession(code);
          if (r1?.error) throw r1.error;

          await sb.auth.signOut();
          hardClearSupabaseSession();

          if (mounted) setPhase("success");
          setTimeout(() => router.replace("/signin"), 2200);
          return;
        } catch (e: any) {
          if (mounted) {
            setErr(e?.message || t("confirmEmail.error.generic"));
            setPhase("error");
          }
          setTimeout(() => router.replace("/signin"), 3000);
          return;
        }
      }

      // 3) Už je prihlásený (napr. druhé kliknutie na ten istý link)
      const { data } = await sb.auth.getSession();
      if (data.session) {
        await sb.auth.signOut();
        hardClearSupabaseSession();
        if (mounted) setPhase("success");
        setTimeout(() => router.replace("/signin"), 1800);
        return;
      }

      // 4) Chýbajú parametre
      if (mounted) {
        setErr(t("confirmEmail.error.missingParams"));
        setPhase("error");
      }
      setTimeout(() => router.replace("/signin"), 3000);
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
                : phase === "error"
                ? t("confirmEmail.errorTitle" as any) || "Chyba overenia"
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

          {phase === "error" && (
            <button onClick={() => router.replace("/signin")} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
              Prejsť na prihlásenie
            </button>
          )}
        </div>
      </div>
    </main>
  );
}