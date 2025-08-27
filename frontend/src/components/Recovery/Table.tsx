"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserId } from "@/lib/userUtils";

interface RecoveryRow {
  id: number;
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_duration_min: number | null;
  sleep_start_timestampz: string | null;
  food_2h_before: boolean | null;
  caffeine_8h: boolean | null;
  alcohol_volume_ml: number | null;
  alcohol_type_pct: number | null;
  comment: string | null;
}

export default function RecoveryTable() {
  const [userId, setUserId] = useState<number | null>(null);
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const id = await getUserId();
      setUserId(id);

      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("users_recovery")
        .select("*")
        .eq("user_id", id)
        .order("date", { ascending: false })
        .limit(14);

      if (error) {
        console.error("Chyba pri načítaní recovery:", error);
      } else {
        setRows(data as RecoveryRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div>Načítavam...</div>;
  if (!userId) return <div>❌ User not found.</div>;
  if (!rows.length) return <div>Žiadne recovery dáta.</div>;

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
      <table className="w-full text-sm">
        {/* hlavička a mapovanie rows */}
      </table>
    </div>
  );
}
