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
          // Presmerovanie na signin aj v prípade chyby po 3 sekundách
          setTimeout(() => router.replace("/signin"), 3000);
          return;
        }

        // Ak chceš, aby sa užívateľ musel na 100% prihlásiť znova ručne,
        // môžeš ho tu pre istotu odhlásiť: await sb.auth.signOut();
        // Zatiaľ tu ponechávame sync (pre istotu) a posielame na signin.
        await syncSessionToServer(sb);
        
        if (mounted) setPhase("success");
        // Predĺžený čas, aby si stihol prečítať správu a presmerovanie na /signin
        setTimeout(() => router.replace("/signin"), 2000); 
        return;
      }

      // 2) Fallback — PKCE code
      const code = sp.get("code");
      if (code) {
        try {
          // @ts-ignore
          const r1 = await sb.auth.exchangeCodeForSession(code);
          if (r1?.error) throw r1.error;
          
          await syncSessionToServer(sb);
          
          if (mounted) setPhase("success");
          setTimeout(() => router.replace("/signin"), 2000);
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
        if (mounted) setPhase("success");
        // Ak je už prihlásený, pošleme ho na aktivity alebo signin. 
        // Necháme signin - ak má session, samotná signin stránka by ho mala hodiť do appky.
        setTimeout(() => router.replace("/signin"), 1500);
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
                ? t("confirmEmail.errorTitle") || "Chyba overenia" 
                : t("confirmEmail.title")}
            </h1>
            <p className={AUTH_TEXT}>
              {phase === "verifying" && t("confirmEmail.verifying")}
              {/* Možno budeš chcieť zmeniť preklad v locales z "Redirecting to app..." na "Presmerúvam na prihlásenie..." */}
              {phase === "success" && t("confirmEmail.redirecting")} 
              {phase === "error" && t("confirmEmail.errorHint")}
            </p>
          </header>

          {err && phase === "error" && (
            <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
              {err}
            </div>
          )}
          
          {/* Ak by si chcel pridať tlačidlo na rýchlejší prechod */}
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
