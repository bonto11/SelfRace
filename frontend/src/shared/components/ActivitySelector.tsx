"use client";

import { useEffect, useRef, useState } from "react";
import { fetchActivitiesAround } from "@/shared/api/activities";
import type { MiniActivity, SportFE } from "@/shared/types/activities";

type Props = {
  userId: number | null;
  dateIso: string | "";
  sports?: SportFE[];
  deltaDays?: number;
  value: number | "";                 // selected activity_id
  onChange: (id: number | "") => void;
  onPicked?: (a: MiniActivity | null) => void;
  className?: string;
};

export default function ActivitySelector({
  userId,
  dateIso,
  sports,
  deltaDays,
  value,
  onChange,
  onPicked,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MiniActivity[]>([]);
  const disabled = !userId || !dateIso;
  const preloadDoneRef = useRef(false);

  // --- preload, keď je už vybraná aktivita (napr. po Edit) ---
  useEffect(() => {
    if (!userId || !dateIso || !value || preloadDoneRef.current) return;
    preloadDoneRef.current = true;
    let alive = true;

    (async () => {
      try {
        const arr = await fetchActivitiesAround(userId, {
          date: dateIso,
          deltaDays,
          sports,
        });
        if (!alive) return;
        setItems(arr);
        const match = arr.find(a => String(a.id) === String(value));
        if (match && typeof onPicked === "function") onPicked(match);
      } catch {
        if (alive) setItems([]);
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateIso, value]);

  // --- fetch pri otvorení (klasické okno ±1 deň) ---
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

  // --- render ---
  return (
    <div className={className}>
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full"
        value={value === "" ? "" : String(value)}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.trim();
          const id = v ? Number(v) : "";
          onChange(id);

          // pošli aj celý objekt, nech sa uloží názov
          if (typeof onPicked === "function") {
            const picked = v ? items.find(x => String(x.id) === v) ?? null : null;
            onPicked(picked);
          }
        }}
        disabled={disabled}
      >
        <option value="">
          {disabled ? "pick date first" : loading ? "Loading…" : "— choose activity —"}
        </option>

        {!loading && items.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}{a.distance_km ? ` (${a.distance_km} km)` : ""}
          </option>
        ))}
      </select>

      {!disabled && (
        <div className="mt-1 text-xs opacity-70">
          Načítané podľa dátumu (±{deltaDays ?? 1} dňa) a športu{" "}
          {sports?.join(", ") ?? "run,mixed"}.
        </div>
      )}
    </div>
  );
}