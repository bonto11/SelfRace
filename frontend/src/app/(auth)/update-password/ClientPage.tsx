// src/app/update-password/ClientPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { inputClass, labelClass, hintClass } from "@/app/shared/ui";
import Button from "@/app/shared/components/ui/Button";

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
          try {
            // @ts-ignore
            const r2 = await sb.auth.exchangeCodeForSession(code);
            ok = !r2?.error;
          } catch {}
        }

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
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm mx-auto p-6 rounded-xl bg-slate-950/60 border border-white/10 text-text">
          <h1 className="text-2xl font-semibold mb-3">Zmeniť heslo</h1>
          <p className="opacity-90">
            O chvíľu ťa prihlásime a zobrazíme formulár…
          </p>
          {err && <p className="text-danger text-sm mt-2">{err}</p>}
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm mx-auto p-6 rounded-xl bg-slate-950/60 border border-white/10 text-text">
          <h1 className="text-2xl font-semibold mb-3">Hotovo</h1>
          <p className="opacity-90">Heslo je zmenené. Prihlasujeme ťa…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm mx-auto p-6 rounded-xl bg-slate-950/60 border border-white/10 text-text">
        <h1 className="text-2xl font-semibold mb-4">Nastaviť nové heslo</h1>

        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <label className={labelClass}>
            Nové heslo
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={pwd1}
                onChange={(e) => setPwd1(e.target.value)}
                placeholder="Zadaj nové heslo"
                className={inputClass}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                aria-label={show ? "Skryť heslo" : "Zobraziť heslo"}
                title={show ? "Skryť heslo" : "Zobraziť heslo"}
              >
                {show ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <PasswordStrengthMeter strength={strength} />

          <label className={labelClass}>
            Potvrdiť nové heslo
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Zadaj znovu heslo"
              className={`${inputClass} mt-1`}
              autoComplete="new-password"
            />
          </label>

          <RequirementsList pwd={pwd1} email={email} />

          {!match && pwd2.length > 0 && (
            <p className="text-sm text-danger">Heslá sa nezhodujú.</p>
          )}
          {err && <p className="text-sm text-danger">{err}</p>}

          <Button
            type="submit"
            variant="primary"
            size="md"
            block
            disabled={!canSubmit || phase === "saving"}
          >
            {phase === "saving" ? "Ukladám…" : "Uložiť"}
          </Button>

          <p className={hintClass + " mt-2"}>
            Po uložení ťa automaticky prihlásime.
          </p>
        </form>
      </div>
    </main>
  );
}

/* -------- Pomocné komponenty a heuristika – nechávam nezmenené -------- */

function PasswordStrengthMeter({
  strength,
}: {
  strength: ReturnType<typeof scorePassword>;
}) {
  const steps = 5; // 0..4
  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {Array.from({ length: steps }).map((_, i) => (
          <div
            key={i}
            className={[
              "h-1.5 flex-1 rounded",
              i < strength.score ? "bg-success" : "bg-surface",
              "border border-border",
            ].join(" ")}
          />
        ))}
      </div>
      <div className="mt-1 text-xs text-muted">
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
    <ul className="mt-1 text-xs">
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