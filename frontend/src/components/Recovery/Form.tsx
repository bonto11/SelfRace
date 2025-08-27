"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserId } from "@/lib/userUtils";

export default function RecoveryForm() {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const id = await getUserId();
      setUserId(id);
    }
    load();
  }, []);

  const [rhr, setRhr] = useState<number | "">("");
  // ...ostatné useState polia

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      alert("❌ Nepodarilo sa nájsť user_id");
      return;
    }

    const { error } = await supabase.from("user_daily_recovery").insert({
      user_id: userId,
      date: new Date().toISOString().split("T")[0],
      RHR_bpm: rhr || null,
      // ...ostatné polia
    });

    if (error) {
      alert("Chyba pri ukladaní: " + error.message);
    } else {
      alert("Záznam uložený ✅");
      // reset formulára...
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* vstupné polia */}
      <button
        type="submit"
        disabled={!userId}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
