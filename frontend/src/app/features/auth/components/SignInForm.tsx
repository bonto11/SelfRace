// src/app/features/auth/components/SignInForm.tsx
"use client";

import { useState } from "react";
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

export default function SignInForm() {
  const router = useRouter();
  const sb = getSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sp = useSearchParams();
  const info =
    sp.get("checkEmail") === "1"
      ? "Poslali sme ti e-mail s odkazom na zmenu hesla. Skontroluj inbox/spam."
      : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pwd,
    });

    setLoading(false);

    if (error) {
      const msg = error.message || "Prihlásenie zlyhalo.";
      setErr(msg);
      toast.error(msg);
      return;
    }

    if (data?.session) {
      try {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
        });
      } catch {
        /* ignore */
      }
    }

    router.replace("/activities");
  }

  return (
    <AuthShell
      title="Prihlásenie"
      description="Vráť sa späť k svojim tréningom, plánom a AI trénerovi."
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
            placeholder="tvoje@email.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className={AUTH_FIELD}>
          <TextField
            type="password"
            placeholder="Heslo"
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {err ? (
          <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
            {err}
          </div>
        ) : null}

        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? "Prihlasujem…" : "Prihlásiť sa"}
        </Button>

        <div className={AUTH_LINK_ROW}>
          <Link
            href="/forgot-password"
            className={AUTH_LINK}
            style={AUTH_LINK_STYLE}
          >
            Zabudnuté heslo?
          </Link>

          <span className={AUTH_TEXT}>
            Nemáš účet?{" "}
            <Link
              href="/signup"
              className={AUTH_LINK}
              style={AUTH_LINK_MUTED_STYLE}
            >
              Registruj sa
            </Link>
          </span>
        </div>

        {/* Strava branding (SVG, neruší, ale je compliant) */}
        <div className="mt-6 flex justify-center">
          <Image
            src={STRAVA_ASSETS.poweredBySvg}
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
          Import aktivít a detailné metriky sú dostupné po prepojení Stravy.
        </p>
      </form>
    </AuthShell>
  );
}