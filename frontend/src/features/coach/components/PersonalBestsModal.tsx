// src/features/coach/components/PersonalBestsModal.tsx
// Modal na edit PB. V lokálnom stave používame stringy (ľahšie ovládanie inputov),
// pri save konvertujeme na shape očakávaný backendom.

"use client";

import { useState } from "react";
import {
  BEST_DISTANCES_M,
  distanceLabel,
  saveBest,
  type UserBest,
} from "@/shared/api/bests";
import { maskHHMMSS, hhmmssToSec, secToHHMMSS } from "@/shared/utils/time";

type Props = {
  userId: number;
  initial: UserBest[];
  onClose: () => void;
  onSaved?: (b: UserBest) => void;
};

// 👇 UI-friendly riadok (všetko stringy)
type EditRow = {
  distance_m: number;
  time_str: string;      // "hh:mm:ss"
  activity_id: string;   // text -> pri save Number()
  achieved_at: string;   // "YYYY-MM-DD"
};

export default function PersonalBestsModal({
  userId,
  initial = [],
  onClose,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<EditRow[]>(() =>
    BEST_DISTANCES_M.map((d) => {
      const found = initial.find((x) => x.distance_m === d);
      return {
        distance_m: d,
        time_str: found?.time_str ?? (secToHHMMSS(found?.best_time_s ?? null) ?? ""),
        activity_id: found?.activity_id != null ? String(found.activity_id) : "",
        achieved_at: found?.achieved_at ?? found?.date ?? "",
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setField = (idx: number, key: keyof EditRow, val: string) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  const handleTimeInput = (idx: number, raw: string) =>
    setField(idx, "time_str", maskHHMMSS(raw));

  async function onSaveAll() {
    setSaving(true);
    setErr(null);
    try {
      for (const r of rows) {
        const timeSec = hhmmssToSec(r.time_str);
        if (!timeSec) continue; // prázdne/invalid preskoč

        await saveBest(userId, {
          distance_m: r.distance_m,
          time_str: r.time_str,
          activity_id: r.activity_id.trim() ? Number(r.activity_id) : undefined,
          achieved_at: r.achieved_at || undefined,
        });

        // optimistic update pre parenta (ak ho poslal)
        onSaved?.({
          distance_m: r.distance_m,
          best_time_s: timeSec,
          time_str: r.time_str,
          activity_id: r.activity_id.trim() ? Number(r.activity_id) : null,
          achieved_at: r.achieved_at || null,
        });
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
                  value={r.time_str}
                  onChange={(e) => handleTimeInput(idx, e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="col">
                <input
                  placeholder="Activity ID (optional)"
                  value={r.activity_id}
                  onChange={(e) => setField(idx, "activity_id", e.target.value)}
                />
              </div>

              <div className="col">
                <input
                  type="date"
                  value={r.achieved_at}
                  onChange={(e) => setField(idx, "achieved_at", e.target.value)}
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
          grid-template-columns: 170px 140px 160px 170px;
          gap: 12px;
          align-items: center;
        }
        .row { display: contents; }
        .label { font-weight: 600; }
        .actions { margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end; }
        input { width: 100%; background: #0f172a; border: 1px solid #374151; padding: 6px 8px; border-radius: 6px; color: #fff; }
        .error { color: #f55; margin-bottom: 8px; }
      `}</style>
    </div>
  );
}