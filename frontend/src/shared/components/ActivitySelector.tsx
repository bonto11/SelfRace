"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchActivitiesAround } from "@/shared/api/activities";
import type { MiniActivity, SportFE } from "@/shared/types/activities";

export type ActivityChoice =
  | { id: number; name: string }
  | { id: ""; name: "" };

type Props = {
  userId: number | null;
  dateIso: string | "";           // ak prázdne -> disabled
  sports?: SportFE[];             // default ["run","mixed"]
  deltaDays?: number;             // default 1
  value: ActivityChoice;          // aktuálna voľba (id + name)
  onChange: (v: ActivityChoice) => void;
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
  const selectedId = value.id === "" ? "" : String(value.id);

  useEffect(() => {
    if (!open || disabled) return;
    let alive = true;
    setLoading(true);
    fetchActivitiesAround(userId!, {
      date: dateIso,
      deltaDays,
      sports,
    })
      .then((arr) => {
        if (!alive) return;
        // garantuj, že každý item má aj name (aspoň "")
        setItems(arr.map((a) => ({ ...a, name: a.name ?? "" })));
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, disabled, userId, dateIso, deltaDays, JSON.stringify(sports)]);

  // ak je vybratá aktivita, no nie je v zozname => pripni ju navrch (aby select videl label)
  const hasCurrent =
    value.id !== "" && items.some((a) => String(a.id) === String(value.id));
  const merged: MiniActivity[] = useMemo(() => {
    if (value.id === "" || hasCurrent) return items;
    return [
      {
        id: Number(value.id),
        name: value.name ?? "",
        start_date: "",
        sport: "",
        distance_km: null,
        duration_min: null,
      },
      ...items,
    ];
  }, [items, value.id, value.name, hasCurrent]);

  return (
    <div className={className}>
      <select
        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full"
        value={selectedId}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (!v) return onChange({ id: "", name: "" });
          const found = merged.find((a) => String(a.id) === v);
          onChange(
            found
              ? { id: found.id as number, name: found.name ?? "" }
              : { id: Number(v), name: "" }
          );
        }}
        disabled={disabled}
      >
        <option value="">
          {disabled ? "pick date first" : loading ? "Loading…" : "— choose activity —"}
        </option>
        {!loading &&
          merged.map((a) => (
            <option key={a.id} value={a.id}>
              {(a.start_date ?? "").slice(0, 10)}
              {a.start_date ? " — " : " "}
              {a.name || "(unnamed)"}
              {a.distance_km ? ` (${a.distance_km} km)` : ""}
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