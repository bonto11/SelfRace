// src/features/auth/RegisterForm.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { CARD } from "@/app/shared/ui/uiTokens";
import { THEME } from "@/app/shared/theme/tokens";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      window.location.assign("/dashboard");
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleRegister} className={`${CARD} max-w-sm mx-auto p-4`}>
      <h1 className="text-base md:text-lg font-semibold mb-3">Register</h1>

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
          {loading ? "Registrujem..." : "Register"}
        </Button>

        <p className="text-xs text-center opacity-80">
          Už máš účet?{" "}
          <a href="/login" style={{ color: THEME.chart.linePrimary }}>
            Prihlás sa
          </a>
        </p>
      </div>
    </form>
  );
}
