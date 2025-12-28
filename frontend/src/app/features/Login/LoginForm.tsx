// src/features/auth/LoginForm.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { CARD } from "@/app/shared/ui/classes";
import { THEME } from "@/app/shared/theme/tokens";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // client-only Supabase
  const supabase = getSupabaseBrowser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // debug – môžeš nechať/odstrániť
    const { data } = await supabase.auth.getSession();
    console.log("[Login] session after login:", data?.session);

    window.location.assign("/activities");
  };

  return (
    <form onSubmit={handleLogin} className={`${CARD} max-w-sm mx-auto p-4`}>
      <h1 className="text-base md:text-lg font-semibold mb-3">Login</h1>

      <div className="space-y-3">
        <TextField
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="Email"
          required
        />
        <TextField
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          placeholder="Heslo"
          required
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Prihlasujem..." : "Login"}
        </Button>

        <p className="text-xs text-center opacity-80">
          Nemáš účet?{" "}
          <a href="/register" style={{ color: THEME.chart.linePrimary }}>
            Zaregistruj sa
          </a>
        </p>
      </div>
    </form>
  );
}
