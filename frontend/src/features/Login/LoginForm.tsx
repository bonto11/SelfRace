"use client";

import { useState } from "react";
import { supabase } from "@/shared/hooks/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } else {
      // redirect alebo reload
      window.location.href = "/dashboard";
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin} className="max-w-sm mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Login</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />

      <input
        type="password"
        placeholder="Heslo"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />

      {error && <p className="text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded"
      >
        {loading ? "Prihlasujem..." : "Login"}
      </button>
      <p className="text-sm text-center">
        Nemáš účet?{" "}
        <a href="/register" className="text-blue-600">
          Zaregistruj sa
        </a>
      </p>
    </form>
  );
}
