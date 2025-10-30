"use client";

import { useEffect, useState } from "react";
import { fetchActivitiesAround } from "@/shared/api/activities";
import type { MiniActivity, SportFE } from "@/shared/types/activities";

type Props = {
  userId: number | null;
  dateIso: string | "";                // ak prázdne -> disabled
  sports?: SportFE[];                  // default ["run","mixed"]
  deltaDays?: number;                  // default 1
  value: number | "";                  // activity_id
  onChange: (id: number | "") => void;
  className?: string;
};

export default function ActivitySelector({
  userId,
  dateIso,
  sports,
  deltaDays,
  value,
  onChange,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MiniActivity[]>([]);
  const disabled = !userId || !dateIso;

  useEffect(() => {
    if (!open || disabled) return;
    let alive = true;
    setLoading(true);
    fetchActivitiesAround(userId!, { date: dateIso, deltaDays, sports })
      .then(arr => { if (alive) setItems(arr); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, disabled, userId, dateIso, deltaDays, JSON.stringify(sports)]);

  return (
    <div className={className}>
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full"
        value={value === "" ? "" : String(value)}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v ? Number(v) : "");
        }}
        disabled={disabled}
      >
        <option value="">
          {disabled ? "pick date first" : loading ? "Loading…" : "— choose activity —"}
        </option>
        {!loading && items.map(a => (
          <option key={a.id} value={a.id}>
            {/* 2025-10-30 — Evening Run (6.0 km) */}
            {(a.start_date ?? "").slice(0,10)} — {a.name}
            {a.distance_km ? ` (${a.distance_km} km)` : ""}
          </option>
        ))}
      </select>
      {!disabled && (
        <div className="mt-1 text-xs opacity-70">
          Načítané podľa dátumu (±{deltaDays ?? 1} dňa) a športu {sports?.join(", ") ?? "run,mixed"}.
        </div>
      )}
    </div>
  );
}