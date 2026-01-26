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

type Phase = "boot" | "ready" | "saving" | "done";

export default function ClientPage() {
  const sb = getSupabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();

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
      const sub = sb.auth.onAuthStateChange((_e, session) => {
        if (session && mounted) setPhase("ready");
      });

      return () => sub.data.subscription.unsubscribe();
    })();

    return () => {
      mounted = false;
    };
  }, [sb, sp]);

  const strength = useMemo(() => scorePassword(pwd1, email), [pwd1, email]);
  const match = pwd1.length > 0 && pwd1 === pwd2;
  const canSubmit = match && strength.score >= 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!canSubmit) {
      setErr(!match ? "Heslá sa nezhodujú." : "Heslo je príliš slabé.");
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
              <h1 className={AUTH_TITLE}>Zmeniť heslo</h1>
              <p className={AUTH_TEXT}>
                O chvíľu ťa prihlásime a zobrazíme formulár…
              </p>
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
              <h1 className={AUTH_TITLE}>Hotovo</h1>
              <p className={AUTH_TEXT}>Heslo je zmenené. Prihlasujeme ťa…</p>
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
            <h1 className={AUTH_TITLE}>Nastaviť nové heslo</h1>
          </header>

          <form onSubmit={submit} className={AUTH_FORM} noValidate>
            {/* New password */}
            <div className={AUTH_FIELD}>
              <label className={AUTH_LABEL}>Nové heslo</label>

              <div className={AUTH_PWD_ROW}>
                <TextField
                  type={show ? "text" : "password"}
                  placeholder="Zadaj nové heslo"
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
                  aria-label={show ? "Skryť heslo" : "Zobraziť heslo"}
                  title={show ? "Skryť heslo" : "Zobraziť heslo"}
                >
                  {show ? "🙈" : "👁️"}
                </button>
              </div>

              <PasswordStrengthMeter strength={strength} />
            </div>

            {/* Confirm password */}
            <div className={AUTH_FIELD}>
              <label className={AUTH_LABEL}>Potvrdiť nové heslo</label>

              <TextField
                type="password"
                placeholder="Zadaj znovu heslo"
                value={pwd2}
                onChange={(e) => setPwd2(e.currentTarget.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <RequirementsList pwd={pwd1} email={email} />

            {!match && pwd2.length > 0 && (
              <div className={AUTH_FEEDBACK} style={AUTH_FEEDBACK_ERROR_STYLE}>
                Heslá sa nezhodujú.
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

            <p className={AUTH_HINT}>Po uložení ťa automaticky prihlásime.</p>
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
  strength: ReturnType<typeof scorePassword>;
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
  const reqs = [
    { ok: pwd.length >= 8, text: "min. 8 znakov" },
    { ok: /[a-z]/.test(pwd), text: "aspoň jedno malé písmeno" },
    { ok: /[A-Z]/.test(pwd), text: "aspoň jedno veľké písmeno" },
    { ok: /[0-9]/.test(pwd), text: "aspoň jedna číslica" },
    { ok: /[^A-Za-z0-9]/.test(pwd), text: "aspoň jeden špeciálny znak" },
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

function scorePassword(pwd: string, email?: string) {
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

  const label = ["veľmi slabé", "slabé", "stredné", "silné", "veľmi silné"][
    score
  ];
  let hint = "";

  if (score < 3) {
    const tips: string[] = [];
    if (len < 12) tips.push("predĺž heslo (12+)");
    if (!/[A-Z]/.test(pwd)) tips.push("pridaj veľké písmeno");
    if (!/[0-9]/.test(pwd)) tips.push("pridaj číslo");
    if (!/[^A-Za-z0-9]/.test(pwd)) tips.push("pridaj špeciálny znak");
    if (local && lowers.includes(local)) tips.push("nepoužívaj e-mail/meno");
    hint = tips.join(", ");
  }

  return { score, label, hint };
}
