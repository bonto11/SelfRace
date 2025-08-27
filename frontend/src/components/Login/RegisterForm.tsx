"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      // Redirect alebo správa o úspechu
      window.location.href = "/dashboard";
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleRegister} className="max-w-sm mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Register</h1>

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
        className="w-full bg-green-600 text-white p-2 rounded"
      >
        {loading ? "Registrujem..." : "Register"}
      </button>
      <p className="text-sm text-center">
        Už máš účet? <a href="/login" className="text-blue-600">Prihlás sa</a>
    </p>

    </form>
  );
}
