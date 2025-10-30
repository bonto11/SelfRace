"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import type { MiniActivity } from "@/shared/types/activities";
import { fetchActivitiesWindow } from "@/shared/api/activities"; // ak nechceš helper, nahraď priamym fetchom

type Props = {
  dateIso: string | "";               // "YYYY-MM-DD"
  value: number | "";                 // activity_id
  onChange: (id: number | "") => void;
  sports?: string[];                  // default ["run","mixed"]
  windowDays?: number;                // koľko dní na každú stranu, default 1
  className?: string;
};

function addDays(iso: string, delta: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function ActivitySelector({
  dateIso,
  value,
  onChange,
  sports = ["run", "mixed"],
  windowDays = 1,
  className = "",
}: Props) {
  const { userId } = useUserId();
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MiniActivity[]>([]);
  const disabled = !dateIso || !userId;

  const { from, to } = useMemo(() => {
    if (!dateIso) return { from: "", to: "" };
    return {
      from: addDays(dateIso, -windowDays),
      to: addDays(dateIso, +windowDays),
    };
  }, [dateIso, windowDays]);

  useEffect(() => {
    if (!opened || disabled) return;
    let alive = true;
    setLoading(true);
    fetchActivitiesWindow(userId!, { from, to, sports })
      .then((arr) => { if (alive) setItems(arr); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [opened, disabled, userId, from, to, sports]);

  return (
    <div className={className}>
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full"
        value={value === "" ? "" : String(value)}
        onFocus={() => setOpened(true)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        disabled={disabled}
      >
        <option value="">
          {disabled ? "pick date first" : loading ? "Loading…" : "— choose activity —"}
        </option>
        {!loading && items.map((a) => (
          <option key={a.id} value={a.id}>
            {a.start_date?.slice(0, 10)} — {a.name}{a.distance_km ? ` (${a.distance_km} km)` : ""}
          </option>
        ))}
      </select>
      <div className="mt-1 text-xs opacity-70">
        Zoznam sa načíta podľa zvoleného dátumu (±{windowDays} deň).
      </div>
    </div>
  );
}