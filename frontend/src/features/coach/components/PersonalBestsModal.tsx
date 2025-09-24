// src/features/coach/components/PersonalBestsModal.tsx
// ---------------------------------------------------------
// Modal na editáciu PB. Ukladá cez shared/api/bests.saveBest.
// ---------------------------------------------------------

"use client";

import { useState } from "react";
import {
  BEST_DISTANCES_M,
  distanceLabel,
  saveBest,
  type UserBest,
} from "@/shared/api/bests";
import {
  maskHHMMSS,
  hhmmssToSec,
  secToHHMMSS,
} from "@/shared/utils/time";

type Props = {
  userId: number;
  initial: UserBest[];
  onClose: () => void;
  onSaved?: (b: UserBest) => void;
};

export default function PersonalBestsModal({
  userId,
  initial = [],
  onClose,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<UserBest[]>(() =>
    BEST_DISTANCES_M.map((d) => {
      const found = initial.find((x) => x.distance_m === d);
      return {
        distance_m: d,
        event_name: found?.event_name ?? "",
        date: found?.date ?? "",
        time_str: found?.time_str ?? secToHHMMSS(found?.best_time_s ?? null),
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setField = (idx: number, key: keyof UserBest, val: any) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r))
    );
  };

  const handleTimeInput = (idx: number, raw: string) => {
    setField(idx, "time_str", maskHHMMSS(raw));
  };

  async function onSaveAll() {
    setSaving(true);
    setErr(null);
    try {
      for (const r of rows) {
        const timeSec = hhmmssToSec(r.time_str || "");
        if (!timeSec) continue; // prázdne polia preskoč
        const payload = {
          distance_m: r.distance_m,
          time_str: r.time_str || undefined,
          time_sec: timeSec,
          event_name: r.event_name || undefined,
          date: r.date || undefined,
        };
        await saveBest(userId, payload);
        onSaved?.({ ...r, best_time_s: timeSec }); // optimistic update
      }
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-body">
        <h3>Upraviť Personal Bests</h3>
        {err && <div className="error">{err}</div>}

        <div className="grid">
          {rows.map((r, idx) => (
            <div key={r.distance_m} className="row">
              <div className="col label">{distanceLabel(r.distance_m)}</div>

              <div className="col">
                <input
                  placeholder="hh:mm:ss"
                  value={r.time_str ?? ""}
                  onChange={(e) => handleTimeInput(idx, e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="col">
                <input
                  placeholder="Event (optional)"
                  value={r.event_name ?? ""}
                  onChange={(e) => setField(idx, "event_name", e.target.value)}
                />
              </div>

              <div className="col">
                <input
                  type="date"
                  value={r.date ?? ""}
                  onChange={(e) => setField(idx, "date", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={onSaveAll} disabled={saving}>Save</button>
        </div>
      </div>

      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: 140px 140px 1fr 160px;
          gap: 12px;
          align-items: center;
        }
        .row { display: contents; }
        .label { font-weight: 600; }
        .actions {
          margin-top: 16px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        input { width: 100%; }
        .error { color: #f55; margin-bottom: 8px; }
      `}</style>
    </div>
  );
}