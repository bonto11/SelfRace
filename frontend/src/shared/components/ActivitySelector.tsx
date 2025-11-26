// src/shared/components/ActivitySelector.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchActivitiesAround } from "@/shared/api/activities";
import type { MiniActivity, SportFE } from "@/shared/types/activities";
import { FIELD_BASE, FIELD_DISABLED, FIELD_HELP } from "@/shared/ui/classes";

type Props = {
  userId: number | null;
  dateIso: string | "";
  sports?: SportFE[];
  deltaDays?: number;
  value: number | "";                 // selected activity_id
  onChange: (id: number | "") => void;
  onPicked?: (a: MiniActivity | null) => void;
  className?: string;
  variant?: "default" | "compact";
};

export default function ActivitySelector({
  userId,
  dateIso,
  sports,
  deltaDays = 1,
  value,
  onChange,
  onPicked,
  className = "",
  variant = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MiniActivity[]>([]);
  const disabled = !userId || !dateIso;
  const preloadDoneRef = useRef(false);

  async function loadActivities() {
    if (!userId || !dateIso) return [] as MiniActivity[];
    return await fetchActivitiesAround(userId, { date: dateIso, deltaDays, sports });
  }

  // fetch po otvorení selectu
  useEffect(() => {
    if (!open || disabled) return;
    let alive = true;
    setLoading(true);
    loadActivities()
      .then(arr => { if (alive) setItems(arr); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, disabled, userId, dateIso, deltaDays, JSON.stringify(sports)]);

  // AUTO-DOPLNENIE názvu pri edite (bez zmeny výberu)
  useEffect(() => {
    if (!userId || !dateIso || !value || preloadDoneRef.current) return;
    preloadDoneRef.current = true;
    let alive = true;

    (async () => {
      try {
        const arr = await loadActivities();
        if (!alive) return;
        setItems(arr);
        const hit = arr.find(a => String(a.id) === String(value));
        if (onPicked) {
          if (hit) {
            onPicked(hit);
          } else {
            const phantom: MiniActivity = {
              id: Number(value),
              name: "(Unknown activity)",
              sport: (sports?.[0] ?? "run") as SportFE,
              start_date: `${dateIso}T00:00:00Z`,
              distance_km: null,
            };
            onPicked(phantom);
          }
        }
      } catch {
        if (onPicked) {
          const phantom: MiniActivity = {
            id: Number(value),
            name: "(Unknown activity)",
            sport: (sports?.[0] ?? "run") as SportFE,
            start_date: `${dateIso}T00:00:00Z`,
            distance_km: null,
          };
          onPicked(phantom);
        }
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dateIso, value]);

  return (
    <div className={className}>
      <select
        className={[
          FIELD_BASE,
          disabled ? FIELD_DISABLED : "",
        ].join(" ")}
        value={value === "" ? "" : String(value)}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value.trim();
          const id = v ? Number(v) : "";
          onChange(id);

          if (onPicked) {
            const picked = v ? items.find(x => String(x.id) === v) ?? null : null;
            onPicked(picked);
          }
        }}
        disabled={disabled}
      >
        <option value="">
          {disabled
            ? "pick date first"
            : loading
            ? "Loading…"
            : "— žiadna aktivita —"}
        </option>

        {/* len “Názov (X km)” */}
        {!loading && items.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}{a.distance_km ? ` (${a.distance_km} km)` : ""}
          </option>
        ))}
      </select>

      {!disabled && variant === "default" && (
        <div className={FIELD_HELP}>
          Načítané podľa dátumu (±{deltaDays} dňa) a športu{" "}
          {sports?.join(", ") ?? "run,mixed"}.
        </div>
      )}
    </div>
  );
}