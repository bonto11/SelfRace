// src/features/coach/components/PersonalBestsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import PersonalBestsModal from "./PersonalBestsModal";
import { secToHHMMSS } from "@/shared/utils/time";
import { getBests, distanceLabel } from "@/shared/api/bests";
import type { UserBest } from "@/shared/api/bests";

export default function PersonalBestsPanel({
  value,
  onChange,
}: {
  value?: UserBest[];
  onChange?: (v: UserBest[]) => void;
}) {
  const { userId } = useUserId();
  const [bests, setBests] = useState<UserBest[]>(value ?? []);
  const [open, setOpen] = useState(false);

  useEffect(() => setBests(value ?? []), [value]);

  useEffect(() => {
    if (userId && (!value || value.length === 0)) {
      getBests(userId)
        .then((arr) => {
          setBests(arr);
          onChange?.(arr);
        })
        .catch(() => {});
    }
  }, [userId]); // zámerne bez value

  const handleSaved = (b: UserBest) => {
    setBests((prev) => {
      const i = prev.findIndex((x) => x.distance_m === b.distance_m);
      const next = [...prev];
      if (i >= 0) next[i] = { ...next[i], ...b };
      else next.push(b);
      onChange?.(next);
      return next;
    });
  };

  return (
    <div className="bg-gray-800 rounded p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Personal Bests</h3>
        <button
          type="button"
          className="text-sm underline opacity-90 hover:opacity-100"
          onClick={() => setOpen(true)}
        >
          Edit
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {bests?.length ? (
          bests
            .slice()
            .sort((a, b) => a.distance_m - b.distance_m)
            .map((b) => (
              <span key={b.distance_m} className="px-2 py-1 bg-gray-900 rounded border border-gray-700 text-xs">
                {distanceLabel(b.distance_m)}{" "}
                {b.best_time_s != null ? secToHHMMSS(b.best_time_s) : b.time_str || "—"}
              </span>
            ))
        ) : (
          <span className="text-xs opacity-70">No records yet.</span>
        )}
      </div>

      {open && userId != null && (
        <PersonalBestsModal
          userId={userId}
          initial={bests}
          onSaved={handleSaved}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}