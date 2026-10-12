// src/app/features/auth/components/GoogleSignInButton.tsx
"use client";

import { useState } from "react";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import {
  AUTH_DIVIDER,
  AUTH_DIVIDER_LINE_STYLE,
  AUTH_TEXT,
  AUTH_TEXT_STYLE,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

// Farby loga sú pevné podľa pravidiel značky Google – nie sú to farby appky.
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Oddeľovač „alebo“ medzi Google a e-mailom. */
export function AuthOrDivider() {
  const t = useT();
  return (
    <div className={AUTH_DIVIDER}>
      <span className="h-px flex-1" style={AUTH_DIVIDER_LINE_STYLE} />
      <span className={AUTH_TEXT} style={AUTH_TEXT_STYLE}>
        {t("signIn.or")}
      </span>
      <span className="h-px flex-1" style={AUTH_DIVIDER_LINE_STYLE} />
    </div>
  );
}

type Props = {
  disabled?: boolean;
  /** Pred presmerovaním (napr. kontrola súhlasu pri registrácii); false = nepokračuj. */
  onBeforeStart?: () => boolean;
};

/**
 * Prihlásenie aj registrácia cez Google (Supabase OAuth, PKCE).
 * Google vráti usera na /auth/callback, tá vymení kód za session v cookies.
 * PREČO redirect a nie popup: v iOS PWA popup okná nefungujú.
 */
export default function GoogleSignInButton({ disabled, onBeforeStart }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (onBeforeStart && !onBeforeStart()) return;
    setBusy(true);
    const sb = getSupabaseBrowser();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // výber účtu aj pri jednom prihlásenom Google účte (zdieľané zariadenia)
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(t("signIn.googleFailed"));
    }
    // pri úspechu prehliadač odchádza na Google – busy nechávame
  }

  return (
    <Button
      type="button"
      variant="secondary"
      block
      disabled={disabled || busy}
      onClick={start}
      leftIcon={<GoogleLogo />}
    >
      {busy ? t("signIn.googleRedirecting") : t("signIn.google")}
    </Button>
  );
}
